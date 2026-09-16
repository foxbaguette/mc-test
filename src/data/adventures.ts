import { useQueries, useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'

import { atomic } from '@/chain/atomic'
import { RARITY_ORDER } from '@/chain/config'
import { chainDate } from '@/lib/time'

import { queryClient } from './queryClient'
import { refreshPlayer, usePlayer } from './queries'
import * as t from './tables'
import type { Adventure, AdventureMod, AdventureParticipation, AdvTemplate } from './types'

const MIN = 60_000
const HOUR = 60 * MIN


export const ADVENTURE_SCHEMAS = [
  { schema: 'crew.worlds', label: 'Minions' },
  { schema: 'arms.worlds', label: 'Weapons' },
  { schema: 'tool.worlds', label: 'Tools' },
  { schema: 'level.worlds', label: 'Levels' },
  { schema: 'faces.worlds', label: 'Avatars' }
]

/** Local file name of an adventure's artwork. Must match scripts/fetch-adventure-images.mjs. */
export const adventureImageSlug = (image: string) =>
  image.trim().replace(/\.[a-z0-9]+$/i, '').replace(/[^a-zA-Z0-9_-]+/g, '_')

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export const useAdvTemplates = () =>
  useQuery({ queryKey: ['adventures', 'templates'], queryFn: t.readAdvTemplates, staleTime: 6 * HOUR })

export function useTemplateMap() {
  const templates = useAdvTemplates()
  return useMemo(() => new Map((templates.data ?? []).map((row) => [row.templateid, row])), [templates.data])
}

export interface Participation extends AdventureParticipation {
  adventure?: Adventure
}

/** Open adventures the player hasn't joined, and the player's own participations. */
export function useAdventures(account: string | null) {
  const open = useQuery({
    queryKey: ['adventures', 'open'],
    queryFn: t.readOpenAdventures,
    staleTime: MIN,
    refetchInterval: 5 * MIN
  })
  const mine = useQuery({
    queryKey: ['adventures', 'participants', account],
    queryFn: () => t.readParticipations(account!),
    enabled: !!account,
    staleTime: MIN
  })

  const ids = useMemo(() => [...new Set((mine.data ?? []).map((p) => p.adventureid))].sort((a, b) => a - b), [mine.data])
  const first = ids[0] ?? 0
  const last = ids[ids.length - 1] ?? 0
  const joined = useQuery({
    queryKey: ['adventures', 'joined', first, last],
    queryFn: () => t.readAdventureRange(first, last),
    enabled: ids.length > 0,
    staleTime: 10 * MIN
  })

  const lists = useMemo(() => {
    const byId = new Map<number, Adventure>()
    for (const adventure of joined.data ?? []) byId.set(adventure.adventureid, adventure)
    for (const adventure of open.data ?? []) byId.set(adventure.adventureid, adventure)
    const joinedIds = new Set(ids)
    return {
      all: [...byId.values()],
      open: (open.data ?? []).filter((adventure) => !joinedIds.has(adventure.adventureid)),
      participations: (mine.data ?? []).map((p): Participation => ({ ...p, adventure: byId.get(p.adventureid) }))
    }
  }, [open.data, mine.data, joined.data, ids])

  return {
    ...lists,
    isLoading: open.isLoading || mine.isLoading || joined.isLoading,
    isFetching: open.isFetching || mine.isFetching || joined.isFetching
  }
}

/** Which modifier slots the player's member level unlocks. */
export function useModUnlocks() {
  const levels = useQuery({ queryKey: ['adventures', 'levels'], queryFn: t.readLevelUnlocks, staleTime: HOUR })
  const { member } = usePlayer()
  const level = member?.level ?? 1
  return useMemo(() => {
    const levelFor = (slot: number) => levels.data?.find((row) => row.modslot === slot)?.level ?? 1
    return { levelFor, isUnlocked: (slot: number) => levelFor(slot) <= level }
  }, [levels.data, level])
}

export type ModUnlocks = ReturnType<typeof useModUnlocks>

export interface CardGroup {
  template_id: number
  name: string
  rarity: string
  /** IPFS hash of the card art, for templates without a local image. */
  image?: string
  assetIds: string[]
}

/** The player's NFTs of one schema, one entry per template, rarest first. */
async function readInventory(account: string, schema: string) {
  const assets = await atomic.getOwnedAssets<{ name?: string; rarity?: string; img?: string }>({ owner: account, schema_name: schema })
  const groups = new Map<number, CardGroup>()
  for (const asset of assets) {
    const id = Number(asset.template?.template_id)
    if (!id) continue
    const group = groups.get(id)
    if (group) group.assetIds.push(asset.asset_id)
    else
      groups.set(id, {
        template_id: id,
        name: asset.data.name ?? String(id),
        rarity: asset.data.rarity ?? '',
        image: asset.data.img,
        assetIds: [asset.asset_id]
      })
  }
  return [...groups.values()].sort(
    (a, b) => (RARITY_ORDER[a.rarity] ?? 99) - (RARITY_ORDER[b.rarity] ?? 99) || a.name.localeCompare(b.name)
  )
}

export function useAdventureInventory(account: string | null, schema: string) {
  return useQuery({
    queryKey: ['adventures', 'inventory', account, schema],
    enabled: !!account,
    staleTime: 5 * MIN,
    queryFn: () => readInventory(account!, schema)
  })
}

/** Every schema at once, for auto pick. Same cache entries as the picker's own tab. */
export function useAdventureInventories(account: string | null, enabled: boolean) {
  const results = useQueries({
    queries: ADVENTURE_SCHEMAS.map(({ schema }) => ({
      queryKey: ['adventures', 'inventory', account, schema],
      enabled: enabled && !!account,
      staleTime: 5 * MIN,
      queryFn: () => readInventory(account!, schema)
    }))
  })

  return {
    groups: useMemo(() => results.flatMap((result) => result.data ?? []), [results.map((r) => r.dataUpdatedAt).join()]),
    isFetching: results.some((result) => result.isFetching)
  }
}

export function refreshAdventures(account: string | null) {
  return Promise.all([
    ...['open', 'participants', 'joined', 'inventory'].map((key) => queryClient.invalidateQueries({ queryKey: ['adventures', key] })),
    refreshPlayer(account)
  ])
}

// ---------------------------------------------------------------------------
// Modifiers and score (as the original site calculated them)
// ---------------------------------------------------------------------------

export function formatAffixValue(mod: AdventureMod) {
  if (mod.affix_type === 'tlm.mp' || mod.affix_type === 'nft.mp') return (mod.affix_value / 10).toFixed(1)
  if (mod.affix_string === '-') return String(mod.affix_value)
  return mod.affix_string
}

const NUMERIC_FIELDS: Record<string, keyof AdvTemplate> = {
  atk: 'atk',
  def: 'def',
  movcost: 'movcost',
  pow: 'pow',
  level: 'level',
  'nft.mp': 'nft_mp',
  'tlm.mp': 'tlm_mp'
}

/** Whether a card template satisfies an adventure modifier. */
export function modMatches(mod: AdventureMod, template: AdvTemplate) {
  const numeric = NUMERIC_FIELDS[mod.affix_type]
  if (numeric && mod.affix_value !== 99999 && mod.affix_value === template[numeric]) return true

  const wanted = mod.affix_string.toLowerCase()
  if (mod.affix_type === 'element') {
    return wanted === template.element.toLowerCase() || wanted === template.weaponclass.toLowerCase()
  }
  if (mod.affix_string === '-') return false
  const value = (template as unknown as Record<string, unknown>)[mod.affix_type]
  return value !== undefined && wanted === String(value).toLowerCase()
}

/** Team score: 100, multiplied by every unlocked modifier at least one card matches. */
export function teamScore(mods: AdventureMod[], unlocks: ModUnlocks, templates: (AdvTemplate | undefined)[]) {
  const matched = new Set<number>()
  mods.forEach((mod, i) => {
    if (unlocks.isUnlocked(i) && templates.some((template) => template && modMatches(mod, template))) matched.add(i)
  })
  const total = [...matched].reduce((acc, i) => acc * (1 + mods[i].mod_value / 100), 100)
  return { score: Math.floor(total), matched }
}

export interface TeamCandidate {
  asset_id: string
  template_id: number
  template: AdvTemplate
}

/**
 * The three cards that multiply the score highest (fewer, if fewer help).
 * Cards are reduced to the set of modifiers they satisfy: only those sets matter,
 * and a set another card already covers entirely can never win a slot.
 */
export function bestTeam(mods: AdventureMod[], unlocks: ModUnlocks, candidates: TeamCandidate[]) {
  const weight = mods.map((mod, i) => (unlocks.isUnlocked(i) ? 1 + mod.mod_value / 100 : 0))

  const byMask = new Map<number, TeamCandidate>()
  for (const candidate of candidates) {
    let mask = 0
    mods.forEach((mod, i) => {
      if (weight[i] && modMatches(mod, candidate.template)) mask |= 1 << i
    })
    if (mask && !byMask.has(mask)) byMask.set(mask, candidate)
  }

  const masks = [...byMask.keys()].filter((mask, _, all) => !all.some((other) => other !== mask && (other & mask) === mask))
  const value = (mask: number) => weight.reduce((acc, w, i) => (mask & (1 << i) ? acc * w : acc), 1)

  let bestValue = 0
  let best: number[] = []
  const consider = (picks: number[]) => {
    const merged = picks.reduce((acc, i) => acc | masks[i], 0)
    const score = value(merged)
    if (score > bestValue) {
      bestValue = score
      best = picks
    }
  }

  for (let i = 0; i < masks.length; i++) {
    consider([i])
    for (let j = i + 1; j < masks.length; j++) {
      consider([i, j])
      for (let k = j + 1; k < masks.length; k++) consider([i, j, k])
    }
  }

  return best.map((i) => byMask.get(masks[i])!)
}

export const estimatedRp = (score: number, scoreTotal: number, reward: number) => Math.floor((score / (scoreTotal || 1)) * reward)

/** How long after the newest adventure the next one appears; adventure.mc creates them automatically. */
export const useAdventureSettings = () =>
  useQuery({ queryKey: ['adventures', 'settings'], queryFn: t.readAdventureSettings, staleTime: 6 * HOUR })

/** When the next adventure is due: the newest adventure's start plus that interval. */
export function nextAdventureAt(adventures: Adventure[], autoCreateHours: number | undefined, now: number) {
  if (!autoCreateHours || adventures.length === 0) return 0
  const interval = autoCreateHours * 3_600_000
  const newestStart = Math.max(...adventures.map((adventure) => +chainDate(adventure.enter_start)))
  // Creation can run late, and the newest adventure we know of can be several slots old,
  // so count whole intervals forward until the answer is still ahead of us.
  const slots = Math.max(1, Math.ceil((now - newestStart) / interval))
  return newestStart + slots * interval
}
