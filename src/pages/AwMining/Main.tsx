import { useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'

import { RARITY_COLORS, RARITY_ORDER, type Planet } from '@/chain/config'
import { Button } from '@/components/Button'
import { MiningTypePicker } from '@/components/MiningTypePicker'
import { useEquippedTools, useLandTypes, useMiner, useMineTrack, usePlanetMinCommission, useToolInventory } from '@/data/queries'
import { landImage, planetImage, tlmToNumber } from '@/lib/format'
import { addFavLand, addFavTools, setBagAction } from '@/mining/actions'
import { publicUrl } from '@/lib/publicUrl'

import { useChainAction } from './useMemberAction'

const fmt = (n: number, digits = 3) => n.toLocaleString('en-US', { maximumFractionDigits: digits })

export function Main() {
  const queryClient = useQueryClient()
  const { run, busy, account } = useChainAction()
  const miner = useMiner(account)
  const tools = useEquippedTools(account)
  const inventory = useToolInventory(account)
  const landTypes = useLandTypes()
  const mineTrack = useMineTrack()
  const planetMin = usePlanetMinCommission()

  const land = miner.data?.land
  const landType = landTypes.data?.find((l) => l.landtype_id === land?.cardid)
  const equipped = useMemo(() => tools.data ?? [], [tools.data])

  const stats = useMemo(() => {
    const cooldowns = equipped.map((t) => t.cooldown_seconds).sort((a, b) => b - a)
    const mod = (landType?.cooldown_mod ?? 0) / 10
    let cooldown = 0
    if (cooldowns.length === 1) cooldown = cooldowns[0] * mod
    else if (cooldowns.length === 2) cooldown = (cooldowns[0] + cooldowns[1] / 2) * mod
    else if (cooldowns.length >= 3) cooldown = (cooldowns[0] + cooldowns[1]) * mod

    const byRarity: Record<string, number> = {}
    for (const tool of equipped) byRarity[tool.rarity] = (byRarity[tool.rarity] ?? 0) + Number(tool.mining_power ?? 0)
    const buckets = Object.fromEntries((mineTrack.data?.pool_buckets ?? []).map((b) => [b.key, tlmToNumber(b.value)]))
    const tlmPerMine = Object.entries(byRarity).reduce((sum, [rarity, power]) => {
      const share = Math.min(0.8, (power * (landType?.mining_power_mod ?? 0)) / 10000)
      return sum + share * (buckets[rarity] ?? 0)
    }, 0)

    const nftPower = equipped.reduce((sum, t) => sum + Number(t.nft_power ?? 0), 0)
    const shardsPerMine = (nftPower * (landType?.nft_power_mod ?? 0)) / 100
    const perHour = cooldown > 0 ? 3600 / cooldown : 0

    return [
      { label: 'Cooldown', value: `${Math.round(cooldown / 60)} min` },
      { label: 'Mines per hour', value: fmt(perHour) },
      { label: 'Shards per mine', value: fmt(shardsPerMine) },
      { label: 'Shards per hour', value: fmt(shardsPerMine * perHour) },
      { label: 'Estimated average TLM per mine', value: fmt(tlmPerMine, 4), accent: true },
      { label: 'Estimated average TLM per hour', value: fmt(tlmPerMine * perHour, 4), accent: true }
    ]
  }, [equipped, landType, mineTrack.data])

  const commission = (() => {
    const own = (land?.commission ?? 0) / 100
    if (own > 0) return own
    return (planetMin.data?.[land?.planetName?.toLowerCase() as Planet] ?? 0) * 100
  })()

  const sortedEquipped = [...equipped].sort(
    (a, b) => RARITY_ORDER[a.rarity] - RARITY_ORDER[b.rarity] || a.delay - b.delay || a.toolname.localeCompare(b.toolname)
  )
  const unequipped = (inventory.data ?? [])
    .filter((asset) => !equipped.some((t) => t.asset_id === asset.asset_id))
    .sort((a, b) => RARITY_ORDER[a.data.rarity] - RARITY_ORDER[b.data.rarity])

  const refreshTools = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['equippedTools', account] }),
      queryClient.invalidateQueries({ queryKey: ['toolInventory', account] })
    ])
  const refreshMember = () => queryClient.invalidateQueries({ queryKey: ['member', account] })

  return (
    <>
      <section className="panel">
        <div className="panel__head">
          <h2 className="panel__title">Current Selection</h2>
        </div>

        <div className="selection-card">
          <div className="land-card">
            {miner.isLoading ? (
              <div className="skeleton land-card__img" />
            ) : land ? (
              <>
                <div className="land-card__media">
                  <img className="land-card__img" src={landImage(land.landName)} alt={land.landName} />
                  <img className="land-card__planet" src={planetImage(land.planetName)} alt={land.planetName} />
                  <span className="land-card__coords num">
                    {land.x}:{land.y}
                  </span>
                </div>
                <div className="land-card__caption">
                  <strong>{land.landName}</strong>
                  <span className="muted">{land.planetName}</span>
                </div>
              </>
            ) : null}
            <Button
              color="gradientYellow"
              block
              disabled={busy || !miner.data}
              onClick={() => run((a, p) => addFavLand(a, p, miner.data!.current_land), 'Current Land added to favorites', refreshMember)}
            >
              Add to favorites
            </Button>
          </div>

          <dl className="stat-tiles">
            {stats.map((s) => (
              <div key={s.label} className={s.accent ? 'is-accent' : ''}>
                <dt>{s.label}</dt>
                <dd className="num">{tools.isLoading ? '…' : s.value}</dd>
              </div>
            ))}
            <div>
              <dt>Commission</dt>
              <dd className="num">{commission} %</dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="panel">
        <div className="panel__head">
          <h2 className="panel__title">Mine Button</h2>
        </div>
        <MiningTypePicker />
      </section>

      <section className="panel">
        <div className="panel__head">
          <h2 className="panel__title">
            Tools <span className="chip num">{equipped.length}/3</span>
          </h2>
          <Button
            color="gradientYellow"
            size="sm"
            disabled={busy || equipped.length === 0}
            onClick={() => run((a, p) => addFavTools(a, p, equipped.map((t) => t.asset_id).join(',')), 'Current Tools added to favorites', refreshMember)}
          >
            Add current setup to favorites
          </Button>
        </div>

        <div className="tool-grid">
          {tools.isLoading
            ? [0, 1, 2].map((i) => <div key={i} className="skeleton tool-card__loading" />)
            : sortedEquipped.map((tool) => (
                <div key={tool.asset_id} className="tool-card is-equipped" style={{ '--rarity': RARITY_COLORS[tool.rarity] } as React.CSSProperties}>
                  <img src={publicUrl(`/assets/aw-nft-images/${tool.template_id}.webp`)} alt={tool.name} title={tool.name} loading="lazy" />
                  <Button
                    color="ghost"
                    size="sm"
                    block
                    disabled={busy}
                    onClick={() =>
                      run(
                        (a, p) => setBagAction(a, p, equipped.filter((t) => t.asset_id !== tool.asset_id).map((t) => t.asset_id)),
                        'Tool removed from current setup',
                        refreshTools
                      )
                    }
                  >
                    Unequip
                  </Button>
                </div>
              ))}
          {inventory.isLoading
            ? [0, 1, 2, 3].map((i) => <div key={i} className="skeleton tool-card__loading" />)
            : unequipped.map((asset) => (
                <div key={asset.asset_id} className="tool-card" style={{ '--rarity': RARITY_COLORS[asset.data.rarity] } as React.CSSProperties}>
                  <img src={publicUrl(`/assets/aw-nft-images/${asset.template?.template_id}.webp`)} alt={asset.data.name} title={asset.data.name} loading="lazy" />
                  <Button
                    size="sm"
                    block
                    disabled={busy || equipped.length >= 3}
                    onClick={() =>
                      run((a, p) => setBagAction(a, p, [...equipped.map((t) => t.asset_id), asset.asset_id]), 'Tool added to current setup', refreshTools)
                    }
                  >
                    Equip
                  </Button>
                </div>
              ))}
        </div>
      </section>
    </>
  )
}
