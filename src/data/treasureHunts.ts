/** Treasure hunts: open and upcoming ones, and the finished ones with their winners. */

import { useQuery } from '@tanstack/react-query'
import { atomic } from '@/chain/atomic'
import { chainDate } from '@/lib/time'

import { queryClient } from './queryClient'
import * as t from './tables'
import type { Treasure } from './types/game'
import type { LandData } from './types/mining'
import { treasureKeys } from './keys'

const MIN = 60_000
const HOUR = 60 * MIN

/** The whole treasures table, downloaded once for both lists (about 130 kB and growing). */
const readTreasureRows = () =>
  queryClient.fetchQuery({ queryKey: treasureKeys.rows, queryFn: t.readTreasures, staleTime: 10 * MIN })

export interface TreasureHunt extends Treasure {
  planetName: string
  landName: string
  land: LandData
}

/**
 * Every hunt that is worth showing: still undistributed, started within the last
 * ten hours or starting within the week. Several can run at once.
 */

export function useTreasureHunts() {
  return useQuery({
    queryKey: treasureKeys.all,
    staleTime: 10 * MIN,
    queryFn: async (): Promise<TreasureHunt[]> => {
      const rows = await readTreasureRows()
      const now = Date.now()
      const open = rows
        .filter((row) => {
          const start = +chainDate(row.start_date)
          return !row.is_distributed && start > now - 10 * HOUR && start < now + 7 * 24 * HOUR
        })
        .sort((a, b) => +chainDate(a.start_date) - +chainDate(b.start_date))
      if (open.length === 0) return []

      // One lookup for every hunt's land, rather than one request each.
      const assets = await atomic.getAssetsByIds<LandData>(open.map((row) => row.land_id))
      const byId = new Map(assets.map((asset) => [asset.asset_id, asset]))
      return open.flatMap((row) => {
        const asset = byId.get(row.land_id)
        if (!asset) return []
        const [landName, planetName] = asset.data.name.split(' on ')
        return [{ ...row, land: asset.data, landName, planetName }]
      })
    }
  })
}

export interface FinishedHunt extends TreasureHunt {
  winners: string[]
}

/** The hunts that have already paid out, newest first, with the wallets that shared them. */

export function useFinishedHunts(limit = 8) {
  return useQuery({
    queryKey: treasureKeys.finished(limit),
    staleTime: 30 * MIN,
    queryFn: async (): Promise<FinishedHunt[]> => {
      const rows = await readTreasureRows()
      const done = rows
        .filter((row) => row.is_distributed)
        .sort((a, b) => +chainDate(b.start_date) - +chainDate(a.start_date))
        .slice(0, limit)
      if (done.length === 0) return []

      const [assets, winners] = await Promise.all([
        atomic.getAssetsByIds<LandData>(done.map((row) => row.land_id)),
        Promise.all(done.map((row) => t.readTreasureWinners(row.treasure_name).catch(() => null)))
      ])
      const byId = new Map(assets.map((asset) => [asset.asset_id, asset]))

      return done.map((row, i) => {
        const asset = byId.get(row.land_id)
        const [landName = '', planetName = ''] = asset?.data.name.split(' on ') ?? []
        return {
          ...row,
          land: asset?.data ?? ({} as LandData),
          landName,
          planetName,
          winners: winners[i]?.winners ?? []
        }
      })
    }
  })
}

/** Reads the table again, then both lists. */
export const refreshTreasureHunts = () => queryClient.invalidateQueries({ queryKey: treasureKeys.all })
