import { useMemo, useState, type CSSProperties } from 'react'

import { Button } from '@/components/Button'
import { RefreshIcon } from '@/components/icons'
import { PageHeader } from '@/components/PageHeader'
import { monthKey, shiftMonth, summarize, TLM_SOURCES, useTlmHistory, type TlmSource } from '@/data/tlmHistory'
import TLMSVG from '@/icons/tlm'
import { useAccount } from '@/state/session'
import { publicUrl } from '@/lib/publicUrl'

import './TlmHistory.css'

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const PAGE = 100

const sourceMeta = new Map(TLM_SOURCES.map((source) => [source.id, source]))

/** Totals: whole TLM. */
const formatTotal = (value: number) => Math.round(value).toLocaleString('en-US')

/** A single transfer: whole part, then the decimals set apart so the number reads at a glance. */
function Amount({ value }: { value: number }) {
  const [whole, decimals] = value.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 }).split('.')
  return (
    <>
      +{whole}
      <span className="thist__decimals">.{decimals}</span>
    </>
  )
}

/** "16 Sep, 14:02" in UTC, the month's own clock. */
function formatWhen(at: number) {
  const date = new Date(at)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(date.getUTCDate())} ${MONTH_NAMES[date.getUTCMonth()].slice(0, 3)}, ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`
}

export default function TlmHistory() {
  const account = useAccount()
  const current = monthKey(new Date())
  const [month, setMonth] = useState(current)
  const [filter, setFilter] = useState<TlmSource | null>(null)
  const [shown, setShown] = useState(PAGE)

  const history = useTlmHistory(account, month)
  const transfers = useMemo(() => history.data ?? [], [history.data])
  const { total, bySource } = useMemo(() => summarize(transfers), [transfers])
  const visible = useMemo(() => (filter ? transfers.filter((t) => t.source === filter) : transfers), [transfers, filter])

  const [year, monthIndex] = month.split('-').map(Number)
  const monthLabel = `${MONTH_NAMES[monthIndex - 1]} ${year}`
  const progress = history.progress
  const percent = progress && progress.total > 0 ? Math.round((progress.loaded / progress.total) * 100) : 0

  function goTo(key: string) {
    setMonth(key)
    setFilter(null)
    setShown(PAGE)
  }

  return (
    <>
      <PageHeader title="TLM History" image={publicUrl('/assets/background/bg-aw-mining.webp')} />

      <div className="page thist">
        <div className="thist__bar">
          <div className="thist__month">
            <button type="button" className="thist__step" onClick={() => goTo(shiftMonth(month, -1))} aria-label="Previous month">
              <Chevron dir="left" />
            </button>
            <span className="thist__month-label num">{monthLabel}</span>
            <button
              type="button"
              className="thist__step"
              onClick={() => goTo(shiftMonth(month, 1))}
              disabled={month >= current}
              aria-label="Next month"
            >
              <Chevron dir="right" />
            </button>
          </div>

          <button
            className={`icon-btn ${history.isFetching ? 'is-spinning' : ''}`}
            onClick={() => void history.refetch()}
            disabled={history.isFetching}
            aria-label="Refresh"
          >
            <RefreshIcon />
          </button>
        </div>

        {history.isLoading || (history.isFetching && !history.data) ? (
          <div className="thist__loading" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
            <div className="thist__loading-head">
              <span>Loading {monthLabel}</span>
              <span className="num">{progress && progress.total > 0 ? `${progress.loaded} / ${progress.total}` : ''}</span>
            </div>
            <span className={`thist__meter ${!progress?.total ? 'is-waiting' : ''}`}>
              <span style={{ width: `${progress?.total ? percent : 100}%` }} />
            </span>
          </div>
        ) : history.isError ? (
          <p className="thist__empty">Could not load the history. Try again with the refresh button.</p>
        ) : (
          <>
            <section className="thist__summary">
              <div className="thist__total">
                <span className="thist__label">Received in {monthLabel}</span>
                <strong className="num">
                  {formatTotal(total)} <TLMSVG />
                </strong>
                <span className="thist__count num">{transfers.length} transfers</span>
              </div>

              <div className="thist__sources">
                {TLM_SOURCES.map((source) => {
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
              <p className="thist__empty">No TLM received in {monthLabel}</p>
            ) : (
              <ul className="thist__list">
                {visible.slice(0, shown).map((transfer) => {
                  const source = sourceMeta.get(transfer.source)!
                  return (
                    <li key={transfer.id} className="thist__row" style={{ '--source': source.color } as CSSProperties}>
                      <span className="thist__when num">{formatWhen(transfer.at)}</span>
                      <span className="thist__what">
                        <span className="thist__from">
                          <span className="thist__chip">{source.label}</span>
                          <a
                            className="num"
                            href={`https://waxblock.io/transaction/${transfer.trxId}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {transfer.from}
                          </a>
                        </span>
                        {transfer.memo && <span className="thist__memo">{transfer.memo}</span>}
                      </span>
                      <span className="thist__amount num">
                        <span>
                          <Amount value={transfer.amount} />
                        </span>
                        <TLMSVG />
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

function Chevron({ dir }: { dir: 'left' | 'right' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
      <path d={dir === 'left' ? 'm15 6-6 6 6 6' : 'm9 6 6 6-6 6'} />
    </svg>
  )
}
