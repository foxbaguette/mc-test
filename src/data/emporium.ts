import { useQuery } from '@tanstack/react-query'

import { chainDate } from '@/lib/time'

import { refreshPlayer } from './player'
import { queryClient } from './queryClient'
import { readActiveTasks, readCompletedTasks, readEmporiumConfig } from './tables'
import type { EmporiumConfig, EmporiumTask } from './types/emporium'
import { emporiumKeys } from './keys'

const MIN = 60_000

export const useEmporiumConfig = () =>
  useQuery({ queryKey: emporiumKeys.config, queryFn: readEmporiumConfig, staleTime: 60 * MIN })

/** Active tasks; re-read every two minutes so tasks finished by other players disappear. */
export const useActiveTasks = () =>
  useQuery({ queryKey: emporiumKeys.active, queryFn: readActiveTasks, staleTime: MIN, refetchInterval: 2 * MIN })

export const useTaskHistory = () => useQuery({ queryKey: emporiumKeys.history, queryFn: readCompletedTasks, staleTime: MIN })

export function refreshEmporium(account: string | null) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: emporiumKeys.active }),
    queryClient.invalidateQueries({ queryKey: emporiumKeys.history }),
    refreshPlayer(account)
  ])
}

/**
 * The price right now. It starts at currency_start and drops tick_percent_decrease
 * percent for every progress tick since the task was created. TLM prices are
 * returned in whole TLM (the chain stores 1/10000).
 */
export function currentTaskPrice(task: EmporiumTask, config: EmporiumConfig | null | undefined, now: number) {
  const tick = config?.progressupdate_seconds || 1
  const decrease = (config?.tick_percent_decrease ?? 0) / 100
  const created = Math.floor(Math.floor(+chainDate(task.timestamp_created) / 1000) / tick)
  const current = Math.floor(Math.floor(now / 1000) / tick)
  const price = task.currency_start * Math.pow(1 - decrease, Math.max(0, current - created))
  return task.task_type === 'tlm' ? Math.ceil(price / 10000) : Math.floor(price)
}

/** When prices drop next. */
export function nextProgressAt(config: EmporiumConfig, now: number) {
  const tick = config.progressupdate_seconds * 1000
  return tick > 0 ? (Math.floor(now / tick) + 1) * tick : now
}

/** What the player who finished a task paid. */
export const taskPaidAmount = (task: EmporiumTask) =>
  task.task_type === 'tlm' ? Math.ceil(task.currency_end / 10000) : task.currency_end
