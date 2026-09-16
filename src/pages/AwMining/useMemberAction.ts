import { useState } from 'react'
import type { AnyAction } from '@wharfkit/session'
import { useShallow } from 'zustand/react/shallow'

import { toast } from '@/components/toast'
import { sleep } from '@/lib/format'
import { useSession } from '@/state/session'
import { formatTransactError, isUserCancel, transact } from '@/wallet/session'

/** Runs one signed action, shows the success message, then refreshes after the chain has caught up. */
export function useChainAction() {
  const { account, permission } = useSession(useShallow((s) => ({ account: s.account, permission: s.permission })))
  const [busy, setBusy] = useState(false)

  async function run(build: (account: string, permission: string) => AnyAction, success: string, after?: () => unknown) {
    if (!account) return false
    setBusy(true)
    try {
      await transact([build(account, permission)])
      await sleep(1000)
      await after?.()
      if (success) toast.success(success)
      return true
    } catch (err) {
      if (!isUserCancel(err)) toast.error(formatTransactError(err))
      return false
    } finally {
      setBusy(false)
    }
  }

  return { run, busy, account, permission }
}
