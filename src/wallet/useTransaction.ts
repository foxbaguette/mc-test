import { useState } from 'react'
import type { AnyAction } from '@wharfkit/session'
import { useShallow } from 'zustand/react/shallow'

import { toast } from '@/components/toast'
import { sleep } from '@/lib/format'
import { useSession } from '@/state/session'

import { formatTransactError, isUserCancel, transact } from './session'

/**
 * Read-after-write: a node shows a signed transaction about a second later, so the screen reads
 * again then. Nodes that lag a little get one more background read a few seconds after that.
 */
const CATCH_UP_MS = 1000
const LATE_NODE_MS = 3000

type Build = (account: string, permission: string) => AnyAction | AnyAction[]

/**
 * Signs one or more actions for the signed-in player: shows the success toast, reads the changed
 * data again (see CATCH_UP_MS), and turns wallet errors into a message; cancelling in the wallet
 * stays silent. `pending` names the button that is waiting, when a screen has several.
 */
export function useTransaction() {
  const { account, permission } = useSession(useShallow((s) => ({ account: s.account, permission: s.permission })))
  const [pending, setPending] = useState<string | null>(null)

  /** Resolves true once signed and refreshed, false when cancelled or failed. */
  async function run(build: Build, success: string, refresh?: () => unknown, key = 'transaction') {
    if (!account) return false
    setPending(key)
    try {
      const actions = build(account, permission)
      await transact(Array.isArray(actions) ? actions : [actions])
      if (success) toast.success(success)
      if (refresh) {
        await sleep(CATCH_UP_MS)
        await refresh()
        setTimeout(() => void refresh(), LATE_NODE_MS)
      }
      return true
    } catch (err) {
      if (!isUserCancel(err)) toast.error(formatTransactError(err))
      return false
    } finally {
      setPending(null)
    }
  }

  return { run, busy: pending !== null, pending, account, permission }
}
