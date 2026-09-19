import { Ticking } from '@/components/Ticking'
import {
  chestInfo,
  chestPayout,
  decayedVotePower,
  nextPayoutAt,
  usePdLands,
  usePdPower,
  usePdVotePower,
  votePowerBonus
} from '@/data/planetaryDefense'
import { landImage, planetImage } from '@/lib/format'
import { countdown, timeLeft, useClockFor } from '@/lib/time'
import { useAccount } from '@/state/session'

import { Plate } from './shared'

/** A warlord's lands in Planetary Defense, each with the chest its PDT waits in. */
export function Lands() {
  const account = useAccount()
  const power = usePdPower(account)
  const owner = power.data?.owner
  const lands = usePdLands(account, owner?.land_ids)

  const votes = usePdVotePower(account)
  // Re-render when the payout passes, to count down to the next one.
  const payoutAt = nextPayoutAt(Date.now())
  useClockFor([payoutAt])

  const list = lands.data ?? []
  const pdt = list.reduce((sum, land) => sum + (land.chest?.TLM ?? 0), 0)
  // Vote power counts as it will be at the payout, after its monthly decay.
  const voteBonus = votePowerBonus(decayedVotePower(votes.data?.weight ?? 0, votes.data?.votedAt ?? 0, payoutAt))
  const payoutOf = (land: (typeof list)[number]) => chestPayout(land.chest?.TLM ?? 0, land.chest?.chest_level ?? 0, voteBonus)
  const totalPayout = list.reduce((sum, land) => sum + payoutOf(land), 0)
  const fmt = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 2 })

  return (
    <>
      <section className="pd-card">
        <p className="pd-card__eyebrow">Your Lands</p>
        <div className="pd-plates pd-plates--stats">
          <Plate label="Lands" value={String(owner?.numberofland ?? list.length)} accent />
          <Plate label="PDT in chests" value={pdt.toLocaleString('en-US')} accent />
          <Plate label="Defense" value={(owner?.totalDefense ?? 0).toLocaleString('en-US')} />
        </div>

        {/* The next payout: when, how much (estimated from the guide's rules), and the rate behind it. */}
        <div className="pd-payout">
          <div className="pd-payout__when">
            <span className="pd-payout__label">Next payout</span>
            <strong className="num">
              <Ticking render={(tick) => countdown(timeLeft(payoutAt, tick))} />
            </strong>
          </div>
          <div className="pd-payout__amount">
            <span className="pd-payout__label">Estimated</span>
            <strong className="num">≈ {fmt(totalPayout)} PDT</strong>
          </div>
          <p className="pd-payout__rate num">1% base + chest level + {fmt(voteBonus)}% vote power</p>
        </div>
      </section>

      {lands.isLoading ? (
        <div className="pd-lands">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="skeleton pd-land--skeleton" />
          ))}
        </div>
      ) : (
        <div className="pd-lands">
          {list.map((land) => {
            const chest = chestInfo(land.chest?.chest_level ?? 0)
            return (
              <article key={land.assetId} className="pd-land">
                <div className="pd-land__media">
                  <img src={landImage(land.landName)} alt="" loading="lazy" />
                  <img className="pd-land__planet" src={planetImage(land.planetName)} alt={land.planetName} />
                  <span className="pd-land__coords num">
                    {land.x}:{land.y}
                  </span>
                </div>
                <div className="pd-land__body">
                  <h3 className="pd-land__name">{land.landName}</h3>
                  <p className="pd-land__sub">
                    {land.planetName} · {land.rarity}
                  </p>
                  <div className={`pd-chest ${chest.protection > 0 ? '' : 'is-none'}`}>
                    <span className="pd-chest__name">{chest.name}</span>
                    <strong className="num">{(land.chest?.TLM ?? 0).toLocaleString('en-US')} PDT</strong>
                    <span className="pd-chest__protect num">
                      {chest.protection > 0 ? `${chest.protection}% protected` : 'Unprotected'}
                    </span>
                    <span className="pd-chest__payout num">Next payout ≈ {fmt(payoutOf(land))} PDT</span>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </>
  )
}
