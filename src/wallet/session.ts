import type { AnyAction, Session, SessionKit } from '@wharfkit/session'

import { APP_NAME, CHAIN_ID, CONTRACTS } from '@/chain/config'
import { endpointPool } from '@/chain/endpoints'

let kit: Promise<SessionKit> | null = null
let current: Session | undefined

/** Where WharfKit's BrowserLocalStorage (no key prefix) keeps the last session. */
const STORED_SESSION_KEY = 'wharf--session'

/**
 * The wallet code (about 190 kB gzipped) is downloaded on first use, not at startup, and the kit
 * is built after the endpoint pool has been probed, so the wallet broadcasts through a node
 * confirmed up and in sync this session. Only WAX Cloud Wallet, Wombat and Anchor are offered.
 */
function getKit(): Promise<SessionKit> {
  kit ??= (async () => {
    const [{ SessionKit, ChainDefinition }, { default: WebRenderer }, anchor, cloudWallet, wombat] = await Promise.all([
      import('@wharfkit/session'),
      import('@wharfkit/web-renderer'),
      import('@wharfkit/wallet-plugin-anchor'),
      import('@wharfkit/wallet-plugin-cloudwallet'),
      import('@wharfkit/wallet-plugin-wombat'),
      endpointPool.probe()
    ])
    const ui = new WebRenderer()
    // Closing the wallet picker (×, Escape, backdrop) cancels its login promise silently, so
    // kit.login() would never settle and the sign-in buttons would spin forever. Hear the close here.
    const addCancelable = ui.addCancelablePromise
    ui.addCancelablePromise = (cancel: (reason?: string, silent?: boolean) => unknown) =>
      addCancelable((reason?: string, silent?: boolean) => {
        onPickerClosed?.()
        return cancel(reason, silent)
      })
    return new SessionKit({
      appName: APP_NAME,
      chains: [ChainDefinition.from({ id: CHAIN_ID, url: endpointPool.next() })],
      ui,
      walletPlugins: [new cloudWallet.WalletPluginCloudWallet(), new wombat.WalletPluginWombat(), new anchor.WalletPluginAnchor()]
    })
  })()
  // A failed download (offline, stale deploy) can be retried on the next call.
  kit.catch(() => {
    kit = null
  })
  return kit
}

/** Starts the wallet download early, e.g. when a visitor reaches for the sign-in button. */
export function preloadWallet() {
  void getKit().catch(() => undefined)
}

function hasStoredSession(): boolean {
  try {
    return localStorage.getItem(STORED_SESSION_KEY) !== null
  } catch {
    // Storage unreadable: let WharfKit try.
    return true
  }
}

function isUserCancel(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err ?? '')
  return /cancel|closed|rejected by user|user rejected|denied/i.test(message)
}

export async function restoreSession(): Promise<Session | undefined> {
  // Nothing saved means nothing to restore: visitors who never signed in skip the wallet download.
  if (!hasStoredSession()) return undefined
  const k = await getKit()
  try {
    current = await k.restore()
  } catch {
    current = undefined
  }
  return current
}

/** Set while the wallet picker is open; called when the player closes it. */
let onPickerClosed: (() => void) | null = null

/** Opens the wallet picker. Resolves to undefined if the user cancels or closes it. */
export async function login(): Promise<Session | undefined> {
  const k = await getKit()
  const closed = new Promise<undefined>((resolve) => {
    onPickerClosed = () => resolve(undefined)
  })
  try {
    const result = await Promise.race([k.login(), closed])
    if (!result) return undefined
    current = result.session
    return result.session
  } catch (err) {
    if (isUserCancel(err)) return undefined
    throw err
  } finally {
    onPickerClosed = null
  }
}

export async function logout(): Promise<void> {
  const k = await getKit()
  await k.logout(current)
  current = undefined
}

/** Wallets that may sign in but never mine (every mine path checks canMine). */
const NO_MINING_WALLETS = ['anchor']

export const MINING_BLOCKED_MESSAGE = 'Mining unavailable with Anchor'

/** The signed-in wallet plugin, e.g. "cloudwallet", "wombat" or "anchor". */
export function walletId(): string | null {
  return current ? current.walletPlugin.id : null
}

export const canMine = (wallet: string | null) => !wallet || !NO_MINING_WALLETS.includes(wallet)

/** Whether signing these actions would mine from a wallet that may not mine. */
export const minesWithBlockedWallet = (wallet: string | null, actions: AnyAction[]) =>
  !canMine(wallet) && actions.some((a) => String(a.account) === CONTRACTS.M_FEDERATION && String(a.name) === 'mine')

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
  if (minesWithBlockedWallet(session.walletPlugin.id, actions)) throw new Error(MINING_BLOCKED_MESSAGE)
  const result = await session.transact({ actions }, { broadcast: true, expireSeconds: 120 })
  return String(result.resolved?.transaction.id ?? '')
}
