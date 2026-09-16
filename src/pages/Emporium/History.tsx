import { Link } from 'react-router-dom'

import { ArrowLeftCircleIcon } from '@/components/icons'
import { taskPaidAmount, useTaskHistory } from '@/data/emporium'
import ShardsSVG from '@/icons/shards'
import { chainDate, useNow } from '@/lib/time'

import { CurrencyIcon, TaskImage } from './shared'

function elapsed(closedAt: number, now: number) {
  const ms = now - closedAt
  if (ms < 60_000) return 'less than 1 min'
  const days = Math.floor(ms / 86_400_000)
  const hours = Math.floor(ms / 3_600_000) % 24
  const minutes = Math.floor(ms / 60_000) % 60
  return [days && `${days}d`, hours && `${hours}h`, `${minutes}m`].filter(Boolean).join(' ')
}

export function History() {
  const history = useTaskHistory()
  const now = useNow(30_000)

  const rows = [...(history.data ?? [])].sort((a, b) => +chainDate(b.timestamp_closed) - +chainDate(a.timestamp_closed))

  return (
    <>
      <div className="zap-bar">
        <Link to="/emporium" className="zap-back" aria-label="Back">
          <ArrowLeftCircleIcon size={30} />
        </Link>
        <h2 className="zap-bar__title">ZAPP’S TASK HISTORY</h2>
      </div>

      <section className="panel zap-history">
        <div className="zap-history__head" aria-hidden>
          <span>Elapsed</span>
          <span>Wallet</span>
          <span>Task</span>
          <span>Shards</span>
          <span>Support</span>
        </div>

        {history.isLoading ? (
          Array.from({ length: 8 }, (_, i) => <div key={i} className="skeleton zap-history__skeleton" />)
        ) : rows.length === 0 ? (
          <p className="empty">No task history found</p>
        ) : (
          <ul className="zap-history__list">
            {rows.map((task) => (
              <li key={task.task_id} className="zap-history__row">
                <span className="zap-history__elapsed num">{elapsed(+chainDate(task.timestamp_closed), now)}</span>
                <span className="zap-history__wallet">{task.user}</span>
                <span className="zap-history__task">
                  <TaskImage image={task.image} alt={task.title} />
                  <span>{task.title}</span>
                </span>
                <span className="zap-history__shards num">
                  {(task.shards / 10).toLocaleString('en-US')} <ShardsSVG color="rgb(246, 168, 0)" />
                </span>
                <span className="zap-history__support num">
                  {taskPaidAmount(task).toLocaleString('en-US')} <CurrencyIcon type={task.task_type} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}
