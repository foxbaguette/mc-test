import type { CSSProperties } from 'react'
import { useShallow } from 'zustand/react/shallow'

import { RARITY_COLORS } from '@/chain/config'
import { Button } from '@/components/Button'
import { MiningBlocked } from '@/components/MiningBlocked'
import { RefreshIcon } from '@/components/icons'
import { PageHeader } from '@/components/PageHeader'
import { useMaximizerPlanets } from '@/data/maximizer'
import { useMiner } from '@/data/mining'
import { planetImage } from '@/lib/format'
import { cooldownLabel, useNow } from '@/lib/time'
import { mineReadyAt } from '@/mining/estimates'
import { mineNow } from '@/mining/mineNow'
import { useCanMine, useSession } from '@/state/session'
import { publicUrl } from '@/lib/publicUrl'

import './MineMax.css'

/** The Mine Maximizer mines with a fixed land delay, as the original did. */
const MAXIMIZER_LAND_DELAY = 15

export default function MineMax() {
  const { account, permission, miningType, setMiningType } = useSession(
    useShallow((s) => ({
      account: s.account,
      permission: s.permission,
      miningType: s.miningType,
      setMiningType: s.setMiningType
    }))
  )
  const maximizer = useMaximizerPlanets(account)
  const miner = useMiner(account)
  const now = useNow(1000)
  const canMine = useCanMine()

  const tools = maximizer.tools.data ?? []
  const label = cooldownLabel(mineReadyAt(MAXIMIZER_LAND_DELAY, maximizer.tools.data, miner.data?.last_mine), now)
  const ready = label === 'MINE'

  async function setLandAndMine() {
    if (!account) return
    const landId = await maximizer.refreshAndPick()
    await mineNow({ account, permission, tools: maximizer.tools.data, landId })
  }

  return (
    <>
      <PageHeader title="Mine Maximizer" image={publicUrl('/assets/background/mine-bg.jpeg')} />

      <div className="page maxi">
        <MiningBlocked />

        <section className="maxi-bar">
          <ul className="maxi-tools">
            {maximizer.tools.isLoading
              ? [0, 1, 2].map((i) => <li key={i} className="skeleton maxi-tool--skeleton" />)
              : tools.map((tool) => (
                  <li
                    key={tool.asset_id}
                    className="maxi-tool"
                    style={{ '--rarity': RARITY_COLORS[tool.rarity] } as CSSProperties}
                  >
                    <span className="maxi-tool__img">
                      <img src={publicUrl(`/assets/aw-nft-images/${tool.template_id}.webp`)} alt="" loading="lazy" />
                    </span>
                    <span className="maxi-tool__text">
                      <strong>{tool.toolname}</strong>
                      <span className="maxi-tool__rarity">{tool.rarity}</span>
                    </span>
                  </li>
                ))}
          </ul>
          <button
            className={`icon-btn ${maximizer.isFetching ? 'is-spinning' : ''}`}
            onClick={maximizer.refresh}
            disabled={maximizer.isFetching}
            aria-label="Refresh"
          >
            <RefreshIcon />
          </button>
        </section>

        <section className="maxi-planets" aria-busy={maximizer.isLoading}>
          {maximizer.isLoading
            ? Array.from({ length: 6 }, (_, i) => <div key={i} className="skeleton maxi-planet--skeleton" />)
            : maximizer.planets.map(({ row, value }) => (
                <article
                  key={row.asset_id}
                  className={`maxi-planet ${maximizer.best?.row.asset_id === row.asset_id ? 'is-best' : ''}`}
                >
                  <img className="maxi-planet__img" src={planetImage(row.planet)} alt="" />
                  <h3 className="maxi-planet__name">{row.planet}</h3>
                  <p className="maxi-planet__land">
                    {row.land_name}
                    <br />
                    <span className="num">{row.location}</span>
                  </p>
                  <div className="maxi-planet__estimate">
                    <p className="maxi-planet__label">Estimated Mine</p>
                    <p className="maxi-planet__value num">{value.toFixed(4)} TLM</p>
                  </div>
                </article>
              ))}
        </section>

        <div className="maxi-actions">
          <Button
            size="lg"
            color="gradientPink"
            disabled={!canMine || !account || maximizer.isLoading || miner.isLoading || tools.length === 0 || !ready}
            onClick={setLandAndMine}
          >
            <span className="num">{ready ? 'Set Land & Mine' : `Mine Cooldown ${label}`}</span>
          </Button>
          <Button size="lg" color="gradientBlue" disabled={miningType === 'blue'} onClick={() => setMiningType('blue')}>
            Use as Mining Button
          </Button>
        </div>
      </div>
    </>
  )
}
