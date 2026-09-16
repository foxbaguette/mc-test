import { useEffect, useMemo, useState, type CSSProperties } from 'react'

import { RARITY_COLORS, RARITY_ORDER } from '@/chain/config'
import { PageHeader } from '@/components/PageHeader'
import { Select } from '@/components/Select'
import { useAwTools, useEquippedTools, useLandTypes, useMiner, useMineTrack } from '@/data/mining'
import type { AwTool, LandType } from '@/data/types/mining'
import ShardsSVG from '@/icons/shards'
import TLMSVG from '@/icons/tlm'
import { tlmToNumber } from '@/lib/format'
import { useAccount } from '@/state/session'
import { publicUrl } from '@/lib/publicUrl'

import './ToolTactician.css'

const NONE = ''
const DEFAULT_TOOL = 'Standard Shovel'
const DEFAULT_LAND = 'Geothermal Springs'

interface Setup {
  tools: (AwTool | undefined)[]
  land: LandType | undefined
  pools: Record<string, number>
}

/** Cooldown in seconds: only the slowest tool counts fully, the second half (or fully with three). */
function cooldownSeconds({ tools, land }: Setup, landOverride?: LandType) {
  const [first = 0, second = 0, third = 0] = tools.map((tool) => tool?.cooldown_seconds ?? 0).sort((a, b) => b - a)
  const modifier = (landOverride ?? land)?.cooldown_mod ?? 0
  if (!second && !third) return (first * modifier) / 10
  if (!third) return ((first + second / 2) * modifier) / 10
  return ((first + second) * modifier) / 10
}

/** Share of each rarity's pool this setup mines, capped at 80%. */
function rarityShares({ tools, land }: Setup, landOverride?: LandType) {
  const byRarity: Record<string, number> = {}
  for (const tool of tools) {
    if (!tool) continue
    byRarity[tool.rarity] = (byRarity[tool.rarity] ?? 0) + tool.mining_power
  }
  const modifier = (landOverride ?? land)?.mining_power_mod ?? 0
  return Object.entries(byRarity)
    .map(([rarity, power]) => ({ rarity, percentage: Math.min(0.8, (power * modifier) / 10000) * 100 }))
    .filter((entry) => entry.percentage > 0)
}

const tlmPerMine = (setup: Setup, landOverride?: LandType) =>
  rarityShares(setup, landOverride).reduce(
    (sum, { rarity, percentage }) => sum + (percentage / 100) * (setup.pools[rarity] ?? 0),
    0
  )

const shardPower = (setup: Setup, landOverride?: LandType) => {
  const nftPower = setup.tools.reduce((sum, tool) => sum + (tool?.nft_power ?? 0), 0)
  return (nftPower * ((landOverride ?? setup.land)?.nft_power_mod ?? 0)) / 100
}

const shardsPerMine = (setup: Setup, landOverride?: LandType) => (tlmPerMine(setup) === 0 ? 0 : shardPower(setup, landOverride))

/** Rarity colour lifted toward white: Common's own colour is near black and unreadable on the dark UI. */
const rarityTint = (rarity?: string) =>
  rarity && RARITY_COLORS[rarity] ? `color-mix(in srgb, ${RARITY_COLORS[rarity]} 65%, #fff)` : undefined

const perHour = (value: number, seconds: number) => (seconds > 0 ? (value / seconds) * 3600 : 0)

function cooldownLabel(seconds: number) {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const rest = Math.floor(seconds % 60)
  return `${hours > 0 ? `${hours}h ` : ''}${minutes > 0 ? `${minutes}m ` : ''}${rest > 0 ? `${rest}s` : ''}`.trim() || '0s'
}

export default function ToolTactician() {
  const account = useAccount()
  const awTools = useAwTools()
  const landTypes = useLandTypes()
  const mineTrack = useMineTrack()
  const equipped = useEquippedTools(account)
  const miner = useMiner(account)

  const [view, setView] = useState<'general' | 'land'>('general')
  const [names, setNames] = useState<string[]>([NONE, NONE, NONE])
  const [shines, setShines] = useState<string[]>([NONE, NONE, NONE])
  const [landId, setLandId] = useState<number | null>(null)
  const [touched, setTouched] = useState(false)

  const tools = useMemo(() => awTools.data ?? [], [awTools.data])
  const lands = useMemo(() => landTypes.data ?? [], [landTypes.data])

  // A tool name always belongs to one rarity; the shine does not change it.
  const rarityOf = useMemo(() => new Map(tools.map((tool) => [tool.toolname, tool.rarity])), [tools])

  const toolOptions = useMemo(() => {
    // Mythical first, down to Abundant; alphabetical within a rarity.
    const rank = (name: string) => RARITY_ORDER[rarityOf.get(name) ?? ''] ?? 99
    const unique = [...new Set(tools.map((tool) => tool.toolname))].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b))
    return [
      { value: NONE, label: 'None' },
      ...unique.map((name) => ({ value: name, label: name, color: rarityTint(rarityOf.get(name)) }))
    ]
  }, [tools, rarityOf])

  const shineOptions = (name: string) =>
    [...new Set(tools.filter((tool) => tool.toolname === name).map((tool) => tool.shine))].map((shine) => ({
      value: shine,
      label: shine
    }))

  const landOptions = useMemo(() => lands.map((land) => ({ value: String(land.landtype_id), label: land.landname })), [lands])

  // Start from the player's own setup, or a Standard Shovel on Geothermal Springs.
  useEffect(() => {
    if (touched || tools.length === 0 || lands.length === 0) return
    const mine = equipped.data ?? []
    if (mine.length > 0) {
      setNames([0, 1, 2].map((i) => mine[i]?.toolname ?? NONE))
      setShines([0, 1, 2].map((i) => mine[i]?.shine ?? NONE))
      setLandId(lands.find((land) => land.landtype_id === miner.data?.land.cardid)?.landtype_id ?? null)
      return
    }
    setNames([DEFAULT_TOOL, NONE, NONE])
    setShines(['Stone', NONE, NONE])
    setLandId(lands.find((land) => land.landname === DEFAULT_LAND)?.landtype_id ?? null)
  }, [tools, lands, equipped.data, miner.data, touched])

  const setup: Setup = useMemo(() => {
    const picked = names.map((name, i) => tools.find((tool) => tool.toolname === name && tool.shine === shines[i]))
    const pools = Object.fromEntries(
      (mineTrack.data?.pool_buckets ?? []).map((bucket) => [bucket.key, tlmToNumber(bucket.value)])
    )
    return { tools: picked, land: lands.find((land) => land.landtype_id === landId), pools }
  }, [names, shines, tools, lands, landId, mineTrack.data])

  function pickTool(index: number, name: string) {
    setTouched(true)
    setNames((current) => current.map((value, i) => (i === index ? name : value)))
    // Keep the shine if the new tool has it, otherwise take its first one.
    const available = tools.filter((tool) => tool.toolname === name).map((tool) => tool.shine)
    setShines((current) =>
      current.map((value, i) => (i === index ? (available.includes(value) ? value : (available[0] ?? NONE)) : value))
    )
  }

  function pickShine(index: number, shine: string) {
    setTouched(true)
    setShines((current) => current.map((value, i) => (i === index ? shine : value)))
  }

  const seconds = cooldownSeconds(setup)
  const mineTlm = tlmPerMine(setup)
  const mineShards = shardsPerMine(setup)
  const shares = rarityShares(setup)
  const totalPower = shares.reduce((sum, entry) => sum + entry.percentage, 0)
  const pow = setup.tools.reduce((sum, tool) => sum + (tool?.pow ?? 0), 0)

  return (
    <>
      <PageHeader title="Tool Tactician" image={publicUrl('/assets/background/bg-tool-tactician.jpeg')} />

      <div className="page tactician">
        <section className="tactician__setup">
          <div className="tactician__setup-head">
            <h2 className="tactician__setup-title">PICK A TOOL SETUP AND LAND TYPE</h2>
            <button className="tactician__toggle" onClick={() => setView(view === 'land' ? 'general' : 'land')}>
              {view === 'land' ? 'Tool Explorer' : 'Land Overview'}
            </button>
          </div>

          <div className="tactician__selects">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className={`tactician__select ${names[i] !== NONE ? 'is-set' : ''}`}
                style={{ '--rarity': rarityTint(rarityOf.get(names[i])) } as CSSProperties}
              >
                <label className="tactician__label">Tool {i + 1}</label>
                <Select
                  value={names[i]}
                  options={toolOptions}
                  onChange={(value) => pickTool(i, value)}
                  ariaLabel={`Tool ${i + 1}`}
                />
                <Select
                  value={shines[i]}
                  options={shineOptions(names[i])}
                  onChange={(value) => pickShine(i, value)}
                  ariaLabel={`Shine ${i + 1}`}
                  className={names[i] === NONE ? 'is-disabled' : ''}
                />
              </div>
            ))}

            <div className={`tactician__select tactician__select--land ${landId !== null ? 'is-set' : ''}`}>
              <label className="tactician__label">Land Type</label>
              <Select
                value={landId === null ? NONE : String(landId)}
                options={landOptions}
                onChange={(value) => {
                  setTouched(true)
                  setLandId(Number(value))
                }}
                ariaLabel="Land Type"
              />
            </div>
          </div>
        </section>

        {view === 'general' ? (
          <>
            <div className="tactician__grid">
              <section className="tactician__block">
                <h2 className="tactician__heading">Values per Mine</h2>
                <Row label="TLM" value={mineTlm.toFixed(4)} icon={<TLMSVG color="#fff" />} />
                <Row label="Shards" value={mineShards.toFixed(1)} icon={<ShardsSVG color="#fff" />} />
                <Row label="Cooldown" value={`${(seconds / 60).toFixed(0)} minutes`} />
              </section>

              <section className="tactician__block tactician__block--key">
                <h2 className="tactician__heading">Values per Hour</h2>
                <Row label="TLM" value={perHour(mineTlm, seconds).toFixed(4)} icon={<TLMSVG />} highlight />
                <Row label="Shards" value={perHour(mineShards, seconds).toFixed(2)} icon={<ShardsSVG />} highlight />
                <Row label="Mines" value={perHour(1, seconds).toFixed(2)} />
              </section>

              <section className="tactician__block">
                <h2 className="tactician__heading">TLM POOLS AVERAGE (LAST WEEK)</h2>
                {(mineTrack.data?.pool_buckets ?? []).map((bucket) => (
                  <Row
                    key={bucket.key}
                    label={bucket.key}
                    value={tlmToNumber(bucket.value).toFixed(4)}
                    icon={<TLMSVG color="#fff" />}
                  />
                ))}
              </section>

              <section className="tactician__block">
                <h2 className="tactician__heading">Basic Values</h2>
                <div className="tactician__row">
                  <span>Rarity Mining Power</span>
                  <span className="tactician__rarities num">
                    {shares.map((share) => (
                      <span key={share.rarity}>
                        {share.rarity[0]} {share.percentage.toFixed(0)}%
                      </span>
                    ))}
                  </span>
                </div>
                <Row label="Total Mining Power" value={`${totalPower.toFixed(0)}%`} />
                <Row label="Shard Power" value={shardPower(setup).toFixed(1)} />
                <Row label="Proof of Work" value={pow.toFixed(0)} />
                <Row label="Cooldown" value={`${seconds.toFixed(0)} seconds`} />
              </section>
            </div>
          </>
        ) : (
          <section className="tactician__lands">
            <h2 className="tactician__heading">LAND OVERVIEW</h2>
            <div className="tactician__land-row tactician__land-row--head">
              <span>Land Type</span>
              <span>Shards / h</span>
              <span>TLM / h</span>
              <span>Cooldown</span>
            </div>
            {lands.map((land) => {
              const landSeconds = cooldownSeconds(setup, land)
              return (
                <div key={land.landtype_id} className={`tactician__land-row ${land.landtype_id === landId ? 'is-current' : ''}`}>
                  <span>{land.landname}</span>
                  <span className="num">{perHour(shardsPerMine(setup, land), landSeconds).toFixed(2)}</span>
                  <span className="num">{perHour(tlmPerMine(setup, land), landSeconds).toFixed(4)}</span>
                  <span className="num">{cooldownLabel(landSeconds)}</span>
                </div>
              )
            })}
          </section>
        )}
      </div>
    </>
  )
}

function Row({ label, value, icon, highlight }: { label: string; value: string; icon?: React.ReactNode; highlight?: boolean }) {
  return (
    <div className={`tactician__row ${highlight ? 'is-highlight' : ''}`}>
      <span>{label}</span>
      <span className="tactician__value num">
        {value}
        {icon}
      </span>
    </div>
  )
}
