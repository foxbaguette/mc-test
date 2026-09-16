import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'

import { RARITY_COLORS } from '@/chain/config'
import { AsyncIconButton, Button } from '@/components/Button'
import { useFavorites, type FavoriteLand } from '@/data/favorites'
import { refreshMining, useEquippedTools, useMiner } from '@/data/queries'
import HearthBrokenSVG from '@/icons/hearth-broken'
import RefreshSVG from '@/icons/refresh'
import ShardsSVG from '@/icons/shards'
import StarSVG from '@/icons/star'
import TLMSVG from '@/icons/tlm'
import { landImage, planetImage } from '@/lib/format'
import { cooldownLabel, useNow } from '@/lib/time'
import { remFavLand, remFavTools, setBagAction, setLandAction } from '@/mining/actions'
import { mineReadyAt } from '@/mining/estimates'
import { mineNow } from '@/mining/mineNow'
import { publicUrl } from '@/lib/publicUrl'

import { useChainAction } from './useMemberAction'

export function Favorites() {
  const queryClient = useQueryClient()
  const { run, busy, account, permission } = useChainAction()
  const favorites = useFavorites(account)
  const tools = useEquippedTools(account)
  const miner = useMiner(account)
  const now = useNow(1000)
  const [mining, setMining] = useState<string | null>(null)

  const equippedIds = (tools.data ?? []).map((t) => t.asset_id)
  const activeSet = favorites.toolSets.findIndex(
    (set) => set.assetIds.length === equippedIds.length && set.assetIds.every((id) => equippedIds.includes(id))
  )

  const readyAt = (land: FavoriteLand) => mineReadyAt(land.delay, tools.data, miner.data?.last_mine)
  const withLabel = favorites.lands.map((land) => ({ land, label: cooldownLabel(readyAt(land), now) }))
  const ready = withLabel.filter((l) => l.label === 'MINE').sort((a, b) => b.land.delay - a.land.delay)
  const waiting = withLabel.filter((l) => l.label !== 'MINE').sort((a, b) => a.land.delay - b.land.delay)

  const refreshMember = () => queryClient.invalidateQueries({ queryKey: ['member', account] })

  async function mineLand(landId: string) {
    if (!account) return
    setMining(landId)
    await mineNow({ account, permission, tools: tools.data, landId })
    setMining(null)
  }

  return (
    <>
      <section className="panel">
        <div className="panel__head">
          <h2 className="panel__title">
            Tool Favorites <span className="chip num">{favorites.toolSets.length}/3</span>
          </h2>
        </div>

        <div className="toolsets">
          {favorites.isLoading ? (
            [0, 1].map((i) => <div key={i} className="skeleton toolsets__loading" />)
          ) : favorites.toolSets.length === 0 ? (
            <p className="empty">You don't have any favorite tool</p>
          ) : (
            favorites.toolSets.map((set, index) => (
              <div key={set.value} className={`toolset ${activeSet === index ? 'is-active' : ''}`}>
                <div className="toolset__tools">
                  {set.tools.map((tool) => (
                    <span key={tool.asset_id} className="toolset__tool" style={{ borderColor: RARITY_COLORS[tool.rarity] }} title={tool.name}>
                      <img src={publicUrl(`/assets/aw-nft-images/${tool.template_id}.webp`)} alt={tool.name} loading="lazy" />
                    </span>
                  ))}
                </div>
                <div className="toolset__actions">
                  <Button
                    size="sm"
                    disabled={busy || activeSet === index}
                    onClick={() =>
                      run((a, p) => setBagAction(a, p, set.assetIds), 'Changed tools successfully', () =>
                        queryClient.invalidateQueries({ queryKey: ['equippedTools', account] })
                      )
                    }
                  >
                    Equip
                  </Button>
                  <Button
                    size="sm"
                    color="ghost"
                    disabled={busy}
                    aria-label="Remove from favorites"
                    onClick={() => run((a, p) => remFavTools(a, p, set.value), 'Toolset removed from favorites', refreshMember)}
                  >
                    <HearthBrokenSVG />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="panel">
        <div className="panel__head">
          <h2 className="panel__title">
            Land Favorites <span className="chip num">{favorites.lands.length}/30</span>
          </h2>
          <button
            className={`icon-btn ${favorites.isFetching ? 'is-spinning' : ''}`}
            onClick={() => Promise.all([refreshMining(account), favorites.refetch()])}
            aria-label="Refresh"
          >
            <RefreshSVG />
          </button>
        </div>

        <div className="land-grid land-grid--wide">
          {favorites.isLoading ? (
            Array.from({ length: 4 }, (_, i) => <div key={i} className="skeleton land-grid__loading" />)
          ) : favorites.lands.length === 0 ? (
            <p className="empty">You don't have any favorite land</p>
          ) : (
            [...ready, ...waiting].map(({ land, label }) => (
              <article key={land.asset_id} className={`land-tile ${label === 'MINE' ? 'is-ready' : ''}`}>
                <div className="land-tile__media">
                  <img src={landImage(land.landName)} alt={land.landName} loading="lazy" />
                  <img className="land-card__planet" src={planetImage(land.planetName)} alt={land.planetName} />
                  <span className="land-card__coords num">
                    {land.x}:{land.y}
                  </span>
                  <AsyncIconButton
                    className="land-tile__remove"
                    disabled={busy}
                    aria-label="Remove from favorites"
                    onClick={() => run((a, p) => remFavLand(a, p, land.asset_id), 'Land removed from favorites', refreshMember)}
                  >
                    <HearthBrokenSVG />
                  </AsyncIconButton>
                </div>
                <dl className="land-tile__info">
                  <div>
                    <dt>Estimated TLM</dt>
                    <dd className="num">
                      {land.estimatedTlm.toFixed(4)} <TLMSVG />
                    </dd>
                  </div>
                  <div>
                    <dt>Estimated shards</dt>
                    <dd className="num">
                      {land.shards} <ShardsSVG />
                    </dd>
                  </div>
                  <div>
                    <dt>Estimated MCP</dt>
                    <dd className="num">
                      {land.mcp.toLocaleString('en-US')} <StarSVG />
                    </dd>
                  </div>
                  <div>
                    <dt>Commission</dt>
                    <dd className="num">{land.commissionPercent} %</dd>
                  </div>
                </dl>
                <div className="land-tile__actions">
                  <Button
                    size="sm"
                    color="ghost"
                    block
                    disabled={busy}
                    onClick={() =>
                      run((a, p) => setLandAction(a, p, land.asset_id), 'Land changed successfully', () =>
                        queryClient.invalidateQueries({ queryKey: ['miner', account] })
                      )
                    }
                  >
                    Select
                  </Button>
                  <Button
                    size="sm"
                    block
                    color={label === 'MINE' ? 'gradientYellow' : 'solidBlue'}
                    isLoading={mining === land.asset_id}
                    disabled={busy || mining !== null || label !== 'MINE'}
                    onClick={() => mineLand(land.asset_id)}
                  >
                    <span className="num">{label === 'MINE' ? 'Mine' : label}</span>
                  </Button>
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    </>
  )
}
