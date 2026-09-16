import { create } from 'zustand'

import { canMine, login as walletLogin, logout as walletLogout, permission, restoreSession, walletId } from '@/wallet/session'
import { queryClient } from '@/data/queryClient'

export type MiningType = 'gold' | 'green' | 'orange' | 'blue' | 'red'

export const MINING_OPTIONS: { value: MiningType; label: string }[] = [
  { value: 'gold', label: 'Normal Mining' },
  { value: 'green', label: 'Favorite Lands By Shards' },
  { value: 'orange', label: 'Favorite Lands By TLM' },
  { value: 'blue', label: 'Mine Maximizer' },
  { value: 'red', label: 'Tool Loaning' }
]

const MINING_KEY = 'miningType'

function storedMiningType(): MiningType {
  try {
    const value = localStorage.getItem(MINING_KEY)
    if (MINING_OPTIONS.some((o) => o.value === value)) return value as MiningType
  } catch {
    /* storage unavailable */
  }
  return 'gold'
}

interface SessionState {
  account: string | null
  permission: string
  /** The wallet plugin the player signed in with ("cloudwallet", "wombat", "anchor"). */
  wallet: string | null
  /** True once the stored wallet session has been restored (or found missing). */
  restored: boolean
  miningType: MiningType
  restore: () => Promise<void>
  login: () => Promise<boolean>
  logout: () => Promise<void>
  setMiningType: (type: MiningType) => void
}

export const useSession = create<SessionState>((set) => ({
  account: null,
  permission: 'active',
  wallet: null,
  restored: false,
  miningType: storedMiningType(),

  async restore() {
    // Development only: ?as=<account> shows that account's screens read-only, without a wallet.
    // import.meta.env.DEV is false in production builds, so this branch is removed there.
    if (import.meta.env.DEV) {
      const viewAs = new URLSearchParams(window.location.search).get('as')
      if (viewAs) {
        set({ account: viewAs, restored: true })
        return
      }
    }
    try {
      const session = await restoreSession()
      set({ account: session ? String(session.actor) : null, permission: permission(), wallet: walletId(), restored: true })
    } catch {
      set({ account: null, restored: true })
    }
  },

  async login() {
    const session = await walletLogin()
    if (!session) return false
    set({ account: String(session.actor), permission: permission(), wallet: walletId() })
    return true
  },

  async logout() {
    await walletLogout().catch(() => undefined)
    queryClient.clear()
    set({ account: null, wallet: null })
  },

  setMiningType(type) {
    try {
      localStorage.setItem(MINING_KEY, type)
    } catch {
      /* storage unavailable */
    }
    set({ miningType: type })
  }
}))

export const useAccount = () => useSession((s) => s.account)

/** False for wallets that are not allowed to mine (Anchor). */
export const useCanMine = () => useSession((s) => canMine(s.wallet))
