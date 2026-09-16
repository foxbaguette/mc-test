import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'

import { chainDate } from '@/lib/time'

import { queryClient } from './queryClient'
import { readAllMembers, readFlagReasons, readSupportLog } from './tables'
import { applicationKeys } from './keys'

const MIN = 60_000

/**
 * The support team's queue: members still on trial, not flagged, whose review is due.
 * There is no server-side filter for that, so the member table is read once and cached.
 */
export function usePendingApplications() {
  const members = useQuery({ queryKey: applicationKeys.members, queryFn: readAllMembers, staleTime: 2 * MIN })

  const pending = useMemo(() => {
    const now = Date.now()
    return (members.data ?? [])
      .filter((member) => member.trial && !member.flagged && +chainDate(member.next_review) <= now)
      .sort((a, b) => b.member_id - a.member_id)
  }, [members.data])

  return { pending, isLoading: members.isLoading, isFetching: members.isFetching }
}

export const useFlagReasons = () => useQuery({ queryKey: applicationKeys.reasons, queryFn: readFlagReasons, staleTime: 60 * MIN })

/** What support did with this member before. */
export const useSupportLog = (wallet: string) =>
  useQuery({ queryKey: applicationKeys.supportLog(wallet), queryFn: () => readSupportLog(wallet), staleTime: 5 * MIN })

export const refreshApplications = () => queryClient.invalidateQueries({ queryKey: applicationKeys.all })
