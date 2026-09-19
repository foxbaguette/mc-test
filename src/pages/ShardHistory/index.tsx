import { useMemo, useState, type CSSProperties } from 'react'

import { Button } from '@/components/Button'
import { ChevronIcon, RefreshIcon } from '@/icons/ui'
import { PageHeader } from '@/components/PageHeader'
import { SHARD_SOURCES, summarize, useShardHistory, type ShardSource } from '@/data/shardHistory'
import { monthKey, shiftMonth } from '@/data/tlmHistory'
import ShardsSVG from '@/icons/shards'
import { formatUtcDayTime, MONTHS } from '@/lib/time'
import { useAccount } from '@/state/session'
import { publicUrl } from '@/lib/publicUrl'

import '../TlmHistory/TlmHistory.css'
import './ShardHistory.css'

const PAGE = 100

const SHARD_COLOR = '#F6A800'

const sourceMeta = new Map(SHARD_SOURCES.map((source) => [source.id, source]))

/** Totals: whole Shards. */
const formatTotal = (value: number) => Math.round(value).toLocaleString('en-US')

/** A single payout: whole part, then the tenth set apart so the number reads at a glance. */
function Amount({ value }: { value: number }) {
  const [whole, decimals] = value.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).split('.')
  return (
    <>
      +{whole}
      <span className="thist__decimals">.{decimals}</span>
    </>
  )
}

/** Shards the player received through ptpxy.worlds, month by month, by the game that paid them. */
export default function ShardHistory() {
  const account = useAccount()
  const current = monthKey(new Date())
  const [month, setMonth] = useState(current)
  const [filter, setFilter] = useState<ShardSource | null>(null)
  const [shown, setShown] = useState(PAGE)

  const history = useShardHistory(account, month)
  const payouts = useMemo(() => history.query.data ?? [], [history.query.data])
  const { total, bySource } = useMemo(() => summarize(payouts), [payouts])
  const visible = useMemo(() => (filter ? payouts.filter((p) => p.source === filter) : payouts), [payouts, filter])

  const [year, monthIndex] = month.split('-').map(Number)
  const monthLabel = `${MONTHS[monthIndex - 1]} ${year}`
  const progress = history.progress
  const percent = progress && progress.total > 0 ? Math.round((progress.loaded / progress.total) * 100) : 0

  function goTo(key: string) {
    setMonth(key)
    setFilter(null)
    setShown(PAGE)
  }

  return (
    <>
      <PageHeader title="Shard History" image={publicUrl('/assets/background/bg-aw-mining.webp')} />

      <div className="page thist">
        <div className="thist__bar">
          <div className="thist__month">
            <button type="button" className="thist__step" onClick={() => goTo(shiftMonth(month, -1))} aria-label="Previous month">
              <ChevronIcon dir="left" />
            </button>
            <span className="thist__month-label num">{monthLabel}</span>
            <button
              type="button"
              className="thist__step"
              onClick={() => goTo(shiftMonth(month, 1))}
              disabled={month >= current}
              aria-label="Next month"
            >
              <ChevronIcon dir="right" />
            </button>
          </div>

          <button
            className={`icon-btn ${history.query.isFetching ? 'is-spinning' : ''}`}
            onClick={() => void history.query.refetch()}
            disabled={history.query.isFetching}
            aria-label="Refresh"
          >
            <RefreshIcon />
          </button>
        </div>

        {history.query.isLoading || (history.query.isFetching && !history.query.data) ? (
          <div className="thist__loading" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
            <div className="thist__loading-head">
              <span>Loading {monthLabel}</span>
              <span className="num">{progress && progress.total > 0 ? `${progress.loaded} / ${progress.total}` : ''}</span>
            </div>
            <span className={`thist__meter ${!progress?.total ? 'is-waiting' : ''}`}>
              <span style={{ width: `${progress?.total ? percent : 100}%` }} />
            </span>
          </div>
        ) : history.query.isError ? (
          <p className="thist__empty">Could not load the history. Try again with the refresh button.</p>
        ) : (
          <>
            <section className="thist__summary">
              <div className="thist__total">
                <span className="thist__label">Received in {monthLabel}</span>
                <strong className="num">
                  {formatTotal(total)} <ShardsSVG color={SHARD_COLOR} />
                </strong>
                <span className="thist__count num">{payouts.length} payouts</span>
              </div>

              <div className="thist__sources shist__sources">
                {SHARD_SOURCES.map((source) => {
                  const entry = bySource.get(source.id)!
                  const share = total > 0 ? (entry.amount / total) * 100 : 0
                  const active = filter === source.id
                  return (
                    <button
                      key={source.id}
                      type="button"
                      className={`thist__source ${active ? 'is-active' : ''} ${entry.count === 0 ? 'is-empty' : ''}`}
                      style={{ '--source': source.color } as CSSProperties}
                      onClick={() => {
                        setFilter(active ? null : source.id)
                        setShown(PAGE)
                      }}
                      aria-pressed={active}
                      disabled={entry.count === 0}
                    >
                      <span className="thist__label">{source.label}</span>
                      <span className="thist__source-amount num">{formatTotal(entry.amount)}</span>
                      <span className="thist__share" aria-hidden>
                        <span style={{ width: `${share}%` }} />
                      </span>
                      <span className="thist__source-meta num">
                        {share.toFixed(1)}% · {entry.count}
                      </span>
                    </button>
                  )
                })}
              </div>
            </section>

            {visible.length === 0 ? (
              <p className="thist__empty">No Shards received in {monthLabel}</p>
            ) : (
              <ul className="thist__list">
                {visible.slice(0, shown).map((payout) => {
                  const source = sourceMeta.get(payout.source)!
                  return (
                    <li key={payout.id} className="thist__row" style={{ '--source': source.color } as CSSProperties}>
                      <span className="thist__when num">{formatUtcDayTime(payout.at)}</span>
                      <span className="thist__what">
                        <span className="thist__from">
                          <span className="thist__chip">{source.label}</span>
                          <a
                            className="num"
                            href={`https://waxblock.io/transaction/${payout.trxId}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {payout.manager}
                          </a>
                        </span>
                      </span>
                      <span className="thist__amount num">
                        <span>
                          <Amount value={payout.amount} />
                        </span>
                        <ShardsSVG color={SHARD_COLOR} />
                      </span>
                    </li>
                  )
                })}
              </ul>
            )}

            {visible.length > shown && (
              <Button className="thist__more" onClick={() => setShown((n) => n + PAGE)}>
                Show more
              </Button>
            )}
          </>
        )}
      </div>
    </>
  )
}
