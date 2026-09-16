import SessionKit, { ChainDefinition, type AnyAction, type Session } from '@wharfkit/session'
import WebRenderer from '@wharfkit/web-renderer'
import { WalletPluginAnchor } from '@wharfkit/wallet-plugin-anchor'
import { WalletPluginCloudWallet } from '@wharfkit/wallet-plugin-cloudwallet'
import { WalletPluginWombat } from '@wharfkit/wallet-plugin-wombat'

import { APP_NAME, CHAIN_ID, CONTRACTS } from '@/chain/config'
import { endpointPool } from '@/chain/endpoints'

let kit: SessionKit | null = null
let current: Session | undefined

/**
 * Built lazily after the endpoint pool has been probed, so the wallet
 * broadcasts through a node confirmed up and in sync this session.
 * Only WAX Cloud Wallet, Wombat and Anchor are offered.
 */
async function getKit(): Promise<SessionKit> {
  if (kit) return kit
  await endpointPool.probe()
  kit = new SessionKit({
    appName: APP_NAME,
    chains: [ChainDefinition.from({ id: CHAIN_ID, url: endpointPool.next() })],
    ui: new WebRenderer(),
    walletPlugins: [new WalletPluginCloudWallet(), new WalletPluginWombat(), new WalletPluginAnchor()]
  })
  return kit
}

function isUserCancel(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err ?? '')
  return /cancel|closed|rejected by user|user rejected|denied/i.test(message)
}

export async function restoreSession(): Promise<Session | undefined> {
  const k = await getKit()
  try {
    current = await k.restore()
  } catch {
    current = undefined
  }
  return current
}

/** Opens the wallet picker. Resolves to undefined if the user cancels. */
export async function login(): Promise<Session | undefined> {
  const k = await getKit()
  try {
    const { session } = await k.login()
    current = session
    return session
  } catch (err) {
    if (isUserCancel(err)) return undefined
    throw err
  }
}

export async function logout(): Promise<void> {
  const k = await getKit()
  await k.logout(current)
  current = undefined
}

/** Wallets that may sign in but never mine (every mine path checks canMine). */
const NO_MINING_WALLETS = ['anchor']

export const MINING_BLOCKED_MESSAGE = 'Mining is not available with Anchor'

/** The signed-in wallet plugin, e.g. "cloudwallet", "wombat" or "anchor". */
export function walletId(): string | null {
  return current ? current.walletPlugin.id : null
}

export const canMine = (wallet: string | null) => !wallet || !NO_MINING_WALLETS.includes(wallet)

export function permission(): string {
  return current ? String(current.permission) : 'active'
}

/** Turns a wallet/chain error into the message users should see. */
export function formatTransactError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err ?? '')
  const message = raw
    .replace(/^.*assertion failure with message:\s*/i, '')
    .replace(/\s*- 3\s*$/, '')
    .trim()
  if (!message) return 'Transaction failed'
  return message.charAt(0).toUpperCase() + message.slice(1)
}

export { isUserCancel }

export async function transact(actions: AnyAction[]): Promise<string> {
  const session = current ?? (await restoreSession())
  if (!session) throw new Error('User not found, please login')
  // Last line of defence: no mine leaves this app from a wallet that may not mine.
  if (
    !canMine(session.walletPlugin.id) &&
    actions.some((a) => String(a.account) === CONTRACTS.M_FEDERATION && String(a.name) === 'mine')
  ) {
    throw new Error(MINING_BLOCKED_MESSAGE)
  }
  const result = await session.transact({ actions }, { broadcast: true, expireSeconds: 120 })
  return String(result.resolved?.transaction.id ?? '')
}
