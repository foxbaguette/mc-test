import { useState, type FormEvent } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'

import { atomic } from '@/chain/atomic'
import { LAND_NAMES, PLANETS, type Planet } from '@/chain/config'
import { Button } from '@/components/Button'
import { useFavorites } from '@/data/favorites'
import { useMiner, usePlanetMinCommission } from '@/data/queries'
import type { LandData } from '@/data/types'
import BoltSVG from '@/icons/bolt'
import FilterSVG from '@/icons/filter'
import HearthSVG from '@/icons/hearth'
import HearthBrokenSVG from '@/icons/hearth-broken'
import PickaxeSVG from '@/icons/pickaxe'
import SearchSVG from '@/icons/search'
import ShardsSVG from '@/icons/shards'
import { landImage, planetImage } from '@/lib/format'
import { addFavLand, remFavLand, setLandAction } from '@/mining/actions'

import { useChainAction } from './useMemberAction'

// "Mountains" also matches "Icy Mountains", so those land templates are pinned explicitly.
const MOUNTAIN_TEMPLATES = '19546,19530,19510,19496,19478,19463'

interface Filter {
  owner: string
  x?: number
  y?: number
}

export function Selection() {
  const queryClient = useQueryClient()
  const { run, busy, account } = useChainAction()
  const miner = useMiner(account)
  const favorites = useFavorites(account)
  const planetMin = usePlanetMinCommission()

  const [planet, setPlanet] = useState<Planet>((miner.data?.land.planetName?.toLowerCase() as Planet) || 'eyeke')
  const [landName, setLandName] = useState(miner.data?.land.landName || LAND_NAMES[0])
  const [filterOpen, setFilterOpen] = useState(false)
  const [filter, setFilter] = useState<Filter>({ owner: '' })

  const available = useQuery({
    queryKey: ['landTemplates', planet],
    staleTime: 60 * 60_000,
    queryFn: async () => {
      const templates = await atomic.getTemplates<{ immutable_data: { name: string } }>({
        collection_name: 'alien.worlds',
        schema_name: 'land.worlds',
        match: planet,
        limit: 100,
        page: 1
      })
      return templates.map((t) => t.immutable_data.name.split(' on ')[0])
    }
  })

  const lands = useQuery({
    queryKey: ['landsOnPlanet', planet, landName, filter],
    staleTime: 60 * 60_000,
    queryFn: async () => {
      const hasCoords = filter.x !== undefined || filter.y !== undefined
      const assets = await atomic.getAssets<LandData>({
        collection_name: 'alien.worlds',
        schema_name: 'land.worlds',
        match: hasCoords ? planet : `${landName} on ${planet}`,
        owner: filter.owner || undefined,
        template_whitelist: landName === 'Mountains' && !hasCoords ? MOUNTAIN_TEMPLATES : undefined,
        'immutable_data:number.x': filter.x,
        'immutable_data:number.y': filter.y,
        limit: 1000,
        page: 1
      })
      return assets
        .map((a) => {
          const [name, planetName] = a.data.name.split(' on ')
          return { ...a.data, asset_id: a.asset_id, owner: a.owner, landName: name, planetName }
        })
        .sort((a, b) => a.commission - b.commission)
    }
  })

  const minPercent = (planetMin.data?.[planet] ?? 0) * 100
  const commissionOf = (raw: number) => Math.max(raw / 100, minPercent)
  const isFavorite = (assetId: string) => favorites.lands.some((l) => l.asset_id === assetId)
  const first = lands.data?.[0]

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const x = String(form.get('x') ?? '')
    const y = String(form.get('y') ?? '')
    setFilter({ owner: String(form.get('owner') ?? '').trim(), x: x ? Number(x) : undefined, y: y ? Number(y) : undefined })
  }

  const refreshMember = () => queryClient.invalidateQueries({ queryKey: ['member', account] })
  const refreshMiner = () => queryClient.invalidateQueries({ queryKey: ['miner', account] })

  return (
    <>
      <section className="panel">
        <div className="panel__head">
          <h2 className="panel__title">Planet</h2>
        </div>
        <div className="planet-picker" role="radiogroup" aria-label="Planet">
          {PLANETS.map((p) => (
            <button key={p} role="radio" aria-checked={planet === p} className={`planet-option ${planet === p ? 'is-selected' : ''}`} onClick={() => setPlanet(p)}>
              <img src={planetImage(p)} alt="" />
              <span>{p}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="panel__head">
          <h2 className="panel__title">Land Type</h2>
        </div>
        <div className="land-types" role="radiogroup" aria-label="Land Type">
          {LAND_NAMES.map((name) => (
            <button
              key={name}
              role="radio"
              aria-checked={landName === name}
              className={`land-type ${landName === name ? 'is-selected' : ''}`}
              disabled={!available.data?.includes(name)}
              onClick={() => {
                setLandName(name)
                setFilter((f) => ({ owner: f.owner }))
              }}
              title={name}
            >
              <img src={landImage(name)} alt={name} loading="lazy" />
            </button>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="panel__head lands-head">
          <h2 className="panel__title">
            {lands.isLoading ? '…' : first ? first.landName : 'No lands found'}
          </h2>
          {first && (
            <div className="lands-head__stats">
              <span className="chip" title="Luck">
                <ShardsSVG /> {(first.luck / 10).toLocaleString('en-US')}
              </span>
              <span className="chip" title="Ease">
                <PickaxeSVG /> {(first.ease / 10).toLocaleString('en-US')}
              </span>
              <span className="chip" title="Delay">
                <BoltSVG fill color="white" /> {(first.delay / 10).toLocaleString('en-US')}
              </span>
            </div>
          )}
          <button className={`icon-btn ${filterOpen ? 'is-active' : ''}`} onClick={() => setFilterOpen((v) => !v)} aria-expanded={filterOpen} aria-label="Filter">
            <FilterSVG />
          </button>
        </div>

        {filterOpen && (
          <form className="land-filter" onSubmit={search}>
            <label>
              <span>Coordinates</span>
              <span className="land-filter__coords">
                <input name="x" inputMode="numeric" defaultValue={filter.x} aria-label="x" />:
                <input name="y" inputMode="numeric" defaultValue={filter.y} aria-label="y" />
              </span>
            </label>
            <label>
              <span>Owner</span>
              <input name="owner" defaultValue={filter.owner} />
            </label>
            <button type="submit" className="icon-btn" aria-label="Search">
              <SearchSVG />
            </button>
          </form>
        )}

        <div className="land-grid">
          {lands.isLoading
            ? Array.from({ length: 8 }, (_, i) => <div key={i} className="skeleton land-grid__loading" />)
            : lands.data?.map((land) => (
                <article key={land.asset_id} className="land-tile">
                  <div className="land-tile__media">
                    <img src={landImage(land.landName)} alt={land.landName} loading="lazy" />
                    <span className="land-card__coords num">
                      {land.x}:{land.y}
                    </span>
                  </div>
                  <dl className="land-tile__info">
                    <div>
                      <dt>Commission</dt>
                      <dd className="num">{commissionOf(land.commission)} %</dd>
                    </div>
                    <div>
                      <dt>Owner</dt>
                      <dd>{land.owner}</dd>
                    </div>
                  </dl>
                  <div className="land-tile__actions">
                    <Button size="sm" block disabled={busy} onClick={() => run((a, p) => setLandAction(a, p, land.asset_id), 'Land added to current setup', refreshMiner)}>
                      Select
                    </Button>
                    {isFavorite(land.asset_id) ? (
                      <Button
                        size="sm"
                        color="ghost"
                        disabled={busy}
                        aria-label="Remove from favorites"
                        onClick={() => run((a, p) => remFavLand(a, p, land.asset_id), 'Land removed from favorites', refreshMember)}
                      >
                        <HearthBrokenSVG />
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        color="gradientYellow"
                        disabled={busy}
                        aria-label="Add to favorites"
                        onClick={() => run((a, p) => addFavLand(a, p, land.asset_id), 'Current Land added to favorites', refreshMember)}
                      >
                        <HearthSVG />
                      </Button>
                    )}
                  </div>
                </article>
              ))}
        </div>
      </section>
    </>
  )
}
