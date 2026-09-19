import { useState } from 'react'
import { Link } from 'react-router-dom'

import { Button } from '@/components/Button'
import { ArrowLeftCircleIcon, HistoryIcon } from '@/icons/ui'
import { currentTaskPrice, nextProgressAt, refreshEmporium, useActiveTasks, useEmporiumConfig } from '@/data/emporium'
import { usePlayer } from '@/data/player'
import type { EmporiumTask } from '@/data/types/emporium'
import ShardsSVG from '@/icons/shards'
import { cooldownLabel, useClockFor } from '@/lib/time'
import { Ticking } from '@/components/Ticking'
import { finishTaskAction } from '@/chain/actions/emporium'
import { useTransaction } from '@/wallet/useTransaction'

import { CurrencyIcon, TaskImage } from './shared'

/** The confirm button unlocks after this many seconds, as on the original. */
const CONFIRM_SECONDS = 3
const SHARD_COLOR = 'rgb(246, 168, 0)'

export function Tasks() {
  const tasks = useActiveTasks()
  const config = useEmporiumConfig()
  const player = usePlayer()
  const { run, busy, account } = useTransaction()
  const [confirming, setConfirming] = useState<{ id: number; since: number } | null>(null)
  // Phones show the first lines of the intro and of each task; a tap opens the rest.
  const [introOpen, setIntroOpen] = useState(false)
  const [openTask, setOpenTask] = useState<number | null>(null)
  const confirmAt = confirming ? confirming.since + CONFIRM_SECONDS * 1000 : undefined
  // Re-render when prices drop and when Confirm unlocks; the countdowns tick on their own.
  const now = useClockFor([config.data ? nextProgressAt(config.data, Date.now()) : undefined, confirmAt])

  const balanceFor = (type: string) =>
    type === 'mcp' ? player.mcPoints : type === 'tlm' ? player.tlm : type === 'qp' ? player.rewardPoints : 0

  async function complete(task: EmporiumTask, price: number) {
    const ok = await run(
      (a, p) => finishTaskAction(a, p, task, price),
      'Task completed successfully',
      () => refreshEmporium(account)
    )
    if (ok) setConfirming(null)
  }

  return (
    <>
      <section className="panel zap-intro">
        <h2 className="zap-intro__title">Zapp's Tasks</h2>
        <p className={introOpen ? 'is-open' : ''} onClick={() => setIntroOpen((open) => !open)} aria-expanded={introOpen}>
          Zapp is currently trying to advance various pressing issues. Assist him in finishing tasks! Zapp will reward the helping
          player with Alien Worlds Shards he found on his journeys. Since he consistently dedicates time to these tasks, each one
          becomes easier to complete over time. Once a task is finished by <u>any</u> player, it will be replaced by a new one.
        </p>
      </section>

      <div className="zap-bar">
        <p className="zap-bar__progress">
          Next Task Progress:{' '}
          <strong className="num">
            {config.data ? (
              <Ticking render={(tick) => cooldownLabel(nextProgressAt(config.data!, tick), tick, '00:00')} />
            ) : (
              '--:--'
            )}
          </strong>
        </p>
        <Link to="history" className="zap-bar__history">
          <HistoryIcon /> History
        </Link>
      </div>

      <section className="zap-grid">
        {tasks.isLoading
          ? Array.from({ length: 8 }, (_, i) => <div key={i} className="skeleton zap-task--skeleton" />)
          : (tasks.data ?? []).map((task) => {
              const price = currentTaskPrice(task, config.data, now)
              const shards = (task.shards / 10).toLocaleString('en-US')
              const enough = balanceFor(task.task_type) >= price
              const isConfirming = confirming?.id === task.task_id
              const locked = isConfirming && confirmAt !== undefined && confirmAt > now

              // Keyed by price so the chip flashes whenever the price drops.
              const priceChip = (key: string) => (
                <span key={`${key}-${price}`} className="zap-price num">
                  {price.toLocaleString('en-US')}
                  <CurrencyIcon type={task.task_type} />
                </span>
              )
              const description = task.description
                .split('[currency]')
                .flatMap((part, i) => (i === 0 ? [part] : [priceChip(String(i)), part]))

              return (
                <article key={task.task_id} className={`panel zap-task ${isConfirming ? 'is-confirming' : ''}`}>
                  <div className="zap-task__media">
                    <TaskImage image={task.image} alt={task.title} />
                    <span className="zap-task__shards num">
                      {shards} <ShardsSVG color={SHARD_COLOR} />
                    </span>
                  </div>

                  <div className="zap-task__body">
                    {isConfirming ? (
                      <div className="zap-task__confirm">
                        <button
                          className="zap-task__cancel"
                          onClick={() => setConfirming(null)}
                          disabled={busy}
                          aria-label="Back"
                        >
                          <ArrowLeftCircleIcon size={24} />
                        </button>
                        <p>
                          Are you sure you want to spend{' '}
                          <span className="zap-price num">
                            {price.toLocaleString('en-US')}
                            {task.task_type === 'tlm' && ' (TLM)'}
                            <CurrencyIcon type={task.task_type} />
                          </span>{' '}
                          to complete the task and gain{' '}
                          <span className="zap-price num">
                            {shards}
                            <ShardsSVG color={SHARD_COLOR} />
                          </span>
                          ?
                        </p>
                      </div>
                    ) : (
                      <>
                        <h3 className="zap-task__title">{task.title}</h3>
                        <p
                          className={`zap-task__desc ${openTask === task.task_id ? 'is-open' : ''}`}
                          onClick={() => setOpenTask((id) => (id === task.task_id ? null : task.task_id))}
                          aria-expanded={openTask === task.task_id}
                        >
                          {description}
                        </p>
                      </>
                    )}
                  </div>

                  <div className="zap-task__action">
                    {/* Phones: the price beside the button, since the description is cut short there. */}
                    {!isConfirming && <span className="zap-task__cost">{priceChip('cost')}</span>}
                    <Button
                      block
                      color={isConfirming ? 'gradientYellow' : 'solidBlue'}
                      disabled={busy || !enough || locked}
                      onClick={
                        isConfirming ? () => complete(task, price) : () => setConfirming({ id: task.task_id, since: Date.now() })
                      }
                    >
                      <span className="num">
                        {!isConfirming ? (
                          task.button
                        ) : locked ? (
                          // Quarter-second ticks, so the count reaches zero right when Confirm unlocks.
                          <Ticking
                            intervalMs={250}
                            render={(tick) => `Confirm (${Math.max(1, Math.ceil((confirmAt! - tick) / 1000))}) s`}
                          />
                        ) : (
                          'Confirm'
                        )}
                      </span>
                    </Button>
                    {/* Always rendered (hidden when affordable) so every card's button sits at the same height. */}
                    <span className={`zap-task__short ${enough ? 'is-hidden' : ''}`} aria-hidden={enough}>
                      Not enough <CurrencyIcon type={task.task_type} />
                    </span>
                  </div>
                </article>
              )
            })}
      </section>
    </>
  )
}
