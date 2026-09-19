import { useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'

import { Button } from '@/components/Button'
import { Modal } from '@/components/Modal'
import { toast } from '@/components/toast'
import {
  ADVENTURE_SCHEMAS,
  bestTeam,
  estimatedRp,
  modMatches,
  refreshAdventures,
  teamScore,
  useAdventureInventories,
  useAdventureInventory,
  useModUnlocks,
  type CardGroup
} from '@/data/adventures'
import { usePlayer } from '@/data/player'
import type { Adventure, AdvTemplate } from '@/data/types/adventures'
import QuestSVG from '@/icons/quest'
import StarSVG from '@/icons/star'
import { chainDate, countdown, timeLeft } from '@/lib/time'
import { joinAdventureAction, startAdventureWithNftsAction } from '@/chain/actions/adventures'
import { useTransaction } from '@/wallet/useTransaction'
import { publicUrl } from '@/lib/publicUrl'

import { AdventureImg, CardImg, ModRow, SponsorRibbon } from './shared'
import { ChevronIcon, CloseIcon } from '@/icons/ui'

type Templates = Map<number, AdvTemplate>

interface DetailProps {
  available: Adventure[]
  templates: Templates
  now: number
}

export function AdventureDetail({ available, templates, now }: DetailProps) {
  const { adventureId } = useParams()
  const adventure = available.find((a) => String(a.adventureid) === adventureId)
  if (!adventure) return <Navigate to="/adventures" replace />
  return <Detail key={adventure.adventureid} adventure={adventure} templates={templates} now={now} />
}

interface Pick {
  asset_id: string
  template_id: number
}

function Detail({ adventure, templates, now }: { adventure: Adventure; templates: Templates; now: number }) {
  const navigate = useNavigate()
  const unlocks = useModUnlocks()
  const { mcPoints } = usePlayer()
  const { run, busy, account } = useTransaction()

  const [slots, setSlots] = useState<(Pick | null)[]>([null, null, null])
  const [active, setActive] = useState(-1)
  const pickerRef = useRef<HTMLDivElement>(null)
  const slotsRef = useRef<HTMLDivElement>(null)
  const pickerOpen = active >= 0
  // Phones show the story's first lines; a tap opens the rest.
  const [storyOpen, setStoryOpen] = useState(false)

  // The picker opens below the Start button; scroll it into view so the choice is visible.
  // On phones it is a sheet over the bottom of the screen: lift the slots to sit just above it.
  useEffect(() => {
    const picker = pickerRef.current
    if (!pickerOpen || !picker) return
    if (getComputedStyle(picker).position !== 'fixed') {
      picker.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      return
    }
    const slotsBottom = slotsRef.current?.getBoundingClientRect().bottom ?? 0
    // Where the sheet ends up, not where its slide-in animation has it right now.
    const overlap = slotsBottom + 12 - (window.innerHeight - picker.offsetHeight)
    if (overlap > 0) window.scrollBy({ top: overlap, behavior: 'smooth' })
  }, [pickerOpen])
  const [schema, setSchema] = useState(ADVENTURE_SCHEMAS[0].schema)
  const [filters, setFilters] = useState<number[]>([])
  const [confirming, setConfirming] = useState(false)
  // Auto pick needs every schema, so it only loads them once the player asks for it.
  const [autoAsked, setAutoAsked] = useState(false)
  const [autoBusy, setAutoBusy] = useState(false)

  const inventory = useAdventureInventory(active >= 0 ? account : null, schema)
  const allInventory = useAdventureInventories(account, autoAsked)
  const { score, matched } = teamScore(
    adventure.mods,
    unlocks,
    slots.map((slot) => (slot ? templates.get(slot.template_id) : undefined))
  )

  const groups = useMemo(
    () =>
      (inventory.data ?? []).filter((group) => {
        if (filters.length === 0) return true
        const template = templates.get(group.template_id)
        return !!template && filters.every((i) => modMatches(adventure.mods[i], template))
      }),
    [inventory.data, filters, templates, adventure.mods]
  )

  const picked = slots.filter((slot): slot is Pick => !!slot)

  // Card art hashes from every inventory loaded so far, for the chosen cards shown in the slots.
  const imageOf = useMemo(() => {
    const map = new Map<number, string>()
    for (const group of [...allInventory.groups, ...(inventory.data ?? [])])
      if (group.image) map.set(group.template_id, group.image)
    return map
  }, [allInventory.groups, inventory.data])

  const notEnough = mcPoints < adventure.point_cost
  const days = adventure.duration_hours / 24

  // A score on its own says little: show it against the best this player's level allows,
  // and against what the adventure would pay out for it.
  const maxScore = Math.floor(
    adventure.mods.reduce((acc, mod, i) => (unlocks.isUnlocked(i) ? acc * (1 + mod.mod_value / 100) : acc), 100)
  )
  const rp = estimatedRp(score, adventure.score_total + score, adventure.reward_qp)

  // Objectives the other slots already complete. The slot being filled doesn't count: its card gets replaced.
  const coveredByOthers = teamScore(
    adventure.mods,
    unlocks,
    slots.map((slot, i) => (slot && i !== active ? templates.get(slot.template_id) : undefined))
  ).matched

  /** Extra score a card would add in the open slot, counting only objectives the team doesn't complete yet. */
  function gainFor(templateId: number) {
    const template = templates.get(templateId)
    if (!template) return 0
    const multiplier = adventure.mods.reduce(
      (acc, mod, i) =>
        unlocks.isUnlocked(i) && !coveredByOthers.has(i) && modMatches(mod, template) ? acc * (1 + mod.mod_value / 100) : acc,
      1
    )
    return Math.round((multiplier - 1) * 100)
  }

  // Runs as soon as every schema is in: the click may come before the cards do.
  useEffect(() => {
    if (!autoBusy || allInventory.isFetching) return
    setAutoBusy(false)

    const candidates = allInventory.groups.flatMap((group) => {
      const template = templates.get(group.template_id)
      return template ? [{ asset_id: group.assetIds[0], template_id: group.template_id, template }] : []
    })
    const picks = bestTeam(adventure.mods, unlocks, candidates)
    if (picks.length === 0) {
      toast.info('No matching NFTs')
      return
    }

    setSlots([0, 1, 2].map((i) => (picks[i] ? { asset_id: picks[i].asset_id, template_id: picks[i].template_id } : null)))
    setActive(-1)
  }, [autoBusy, allInventory.isFetching, allInventory.groups, adventure.mods, templates, unlocks])

  function setSlot(value: Pick | null) {
    setSlots((current) => current.map((slot, i) => (i === active ? value : slot)))
    setActive(-1)
  }

  function choose(group: CardGroup) {
    const free = group.assetIds.find((id) => !slots.some((slot, i) => i !== active && slot?.asset_id === id))
    if (free) setSlot({ asset_id: free, template_id: group.template_id })
  }

  function toggleFilter(index: number) {
    setFilters((current) => (current.includes(index) ? current.filter((i) => i !== index) : [...current, index]))
    // Filtering only makes sense with the card picker open.
    if (active === -1)
      setActive(
        Math.max(
          0,
          slots.findIndex((slot) => !slot)
        )
      )
  }

  async function start() {
    const ids = picked.map((slot) => slot.asset_id)
    const ok = await run(
      (a, p) =>
        ids.length > 0
          ? startAdventureWithNftsAction(a, p, adventure.adventureid, ids)
          : joinAdventureAction(a, p, adventure.adventureid),
      'Adventure started successfully',
      () => refreshAdventures(account)
    )
    setConfirming(false)
    if (ok) navigate('/adventures/running')
  }

  const modRow = (i: number) => (
    <ModRow
      key={i}
      mod={adventure.mods[i]}
      align={i < 5 ? 'left' : 'right'}
      locked={!unlocks.isUnlocked(i)}
      unlockLevel={unlocks.levelFor(i)}
      matched={matched.has(i)}
      filterActive={filters.includes(i)}
      onFilter={() => toggleFilter(i)}
    />
  )

  return (
    <article className="panel adv-detail">
      <header className="adv-hero">
        <AdventureImg className="adv-hero__img" image={adventure.image} />
        <SponsorRibbon adventure={adventure} />
        <div className="adv-hero__stats">
          <span className="num">
            Total Rewards: {adventure.reward_qp} <QuestSVG />
          </span>
          <span className="num">
            Point Cost: {adventure.point_cost.toLocaleString('en-US')} <StarSVG />
          </span>
          <span className="num">Duration: {days} Days</span>
          <span className="num">Current Total Score: {adventure.score_total}</span>
        </div>
        <div className="adv-hero__title">
          <p className="adv-status num">send in period ends in {countdown(timeLeft(+chainDate(adventure.enter_end), now))}</p>
          <h2>{adventure.title}</h2>
        </div>
      </header>

      <p
        className={`adv-flavor ${storyOpen ? 'is-open' : ''}`}
        onClick={() => setStoryOpen((open) => !open)}
        aria-expanded={storyOpen}
      >
        {adventure.flavor}
      </p>

      <div className="adv-board">
        <div className="adv-board__mods">{[0, 1, 2, 3, 4].filter((i) => adventure.mods[i]).map(modRow)}</div>

        <div className="adv-board__center">
          <div className="adv-auto">
            <Button
              size="sm"
              className="adv-auto__btn"
              isLoading={autoBusy}
              disabled={autoBusy}
              onClick={() => {
                setAutoAsked(true)
                setAutoBusy(true)
              }}
            >
              Auto Pick
            </Button>
          </div>

          <div className="adv-slots" ref={slotsRef}>
            {slots.map((slot, i) => (
              <button
                key={i}
                type="button"
                className={`adv-slot ${active === i ? 'is-active' : ''}`}
                onClick={() => setActive(active === i ? -1 : i)}
                aria-pressed={active === i}
              >
                <CardImg
                  templateId={slot?.template_id}
                  template={slot ? templates.get(slot.template_id) : undefined}
                  image={slot ? imageOf.get(slot.template_id) : undefined}
                />
              </button>
            ))}
          </div>
        </div>

        <div className="adv-board__mods">{[5, 6, 7, 8, 9].filter((i) => adventure.mods[i]).map(modRow)}</div>
      </div>

      <footer className="adv-footer">
        <div className="adv-result">
          <div className="adv-result__plate">
            <span className="adv-result__label">Score</span>
            <span className="adv-result__value num">
              {score}
              <small>/ {maxScore}</small>
            </span>
            <span
              className="adv-result__bar"
              role="progressbar"
              aria-valuenow={score}
              aria-valuemin={100}
              aria-valuemax={maxScore}
              aria-label="Score"
            >
              <span style={{ width: `${Math.min(100, (score / maxScore) * 100)}%` }} />
            </span>
          </div>

          <div className="adv-result__plate">
            <span className="adv-result__label">Expected RP rewards</span>
            <span className="adv-result__value num">
              {rp} <QuestSVG />
            </span>
          </div>
        </div>
        <Button
          size="lg"
          className="adv-start"
          color="gradientPink"
          isLoading={busy && !confirming}
          disabled={busy || notEnough}
          onClick={() => (picked.length > 0 ? start() : setConfirming(true))}
        >
          {notEnough ? 'Not enough' : 'Start'}
          {!notEnough && <ChevronIcon />}
        </Button>
        <p>
          {picked.length > 0
            ? `NFTs can be claimed back after ${days} days`
            : 'To complete objectives, choose NFTs before starting.'}
        </p>
      </footer>

      {/* Opens under the whole adventure, full width, so the cards have room. */}
      {active >= 0 && (
        <div className="adv-picker" ref={pickerRef}>
          <button type="button" className="icon-btn adv-picker__close" onClick={() => setActive(-1)} aria-label="Close">
            <CloseIcon />
          </button>
          <div className="adv-picker__tabs" role="tablist">
            {ADVENTURE_SCHEMAS.map((item) => (
              <button
                key={item.schema}
                role="tab"
                aria-selected={schema === item.schema}
                className={`adv-picker__tab ${schema === item.schema ? 'is-active' : ''}`}
                onClick={() => setSchema(item.schema)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="adv-picker__grid">
            <button className="adv-pick" onClick={() => setSlot(null)}>
              <img src={publicUrl('/assets/default-card.png')} alt="" />
            </button>
            {inventory.isLoading
              ? Array.from({ length: 11 }, (_, i) => <div key={i} className="skeleton adv-pick--skeleton" />)
              : groups.map((group) => {
                  const free = group.assetIds.filter((id) => !slots.some((slot, i) => i !== active && slot?.asset_id === id))
                  const gain = gainFor(group.template_id)
                  return (
                    <button
                      key={group.template_id}
                      className="adv-pick"
                      title={group.name}
                      disabled={free.length === 0}
                      onClick={() => choose(group)}
                    >
                      <CardImg
                        templateId={group.template_id}
                        template={templates.get(group.template_id)}
                        image={group.image}
                        alt={group.name}
                      />
                      {gain > 0 && <span className="adv-pick__gain num">+{gain}%</span>}
                      {group.assetIds.length > 1 && <span className="adv-pick__count num">×{free.length}</span>}
                    </button>
                  )
                })}
          </div>
        </div>
      )}

      {confirming && <ConfirmStart busy={busy} onConfirm={start} onClose={() => setConfirming(false)} />}
    </article>
  )
}

function ConfirmStart({ busy, onConfirm, onClose }: { busy: boolean; onConfirm: () => void; onClose: () => void }) {
  return (
    <Modal className="adv-dialog" locked={busy} onClose={onClose}>
      <div className="adv-dialog__body">
        <h2 className="adv-dialog__title">Confirm</h2>
        <p>Are you sure that you want to start the adventure without NFTs?</p>
        <div className="adv-dialog__actions">
          <Button isLoading={busy} disabled={busy} onClick={onConfirm}>
            Confirm
          </Button>
          <Button color="ghost" disabled={busy} onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </Modal>
  )
}
