import { useEffect, useState, type FormEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'

import { saveSettingsActions } from '@/chain/actions/members'
import { Button } from '@/components/Button'
import { MiningTypePicker } from '@/components/MiningTypePicker'
import { NetworkStatus } from '@/components/NetworkStatus'
import { PageHeader } from '@/components/PageHeader'
import { useLevels } from '@/data/game'
import { useMembership } from '@/data/player'
import { useTransaction } from '@/wallet/useTransaction'
import { publicUrl } from '@/lib/publicUrl'
import { playerKeys } from '@/data/keys'

import './UserSettings.css'

export default function UserSettings() {
  const queryClient = useQueryClient()
  const { run, busy: saving, account } = useTransaction()
  const player = useMembership()
  const levels = useLevels()
  const member = player.member

  const [tag, setTag] = useState('')
  const [freeCpu, setFreeCpu] = useState(true)

  useEffect(() => {
    if (!member) return
    setTag(member.playertag ?? '')
    setFreeCpu(member.freecpu === 1)
  }, [member?.playertag, member?.freecpu, member])

  const canEdit = !!member && (!!member.member || !!member.trial)

  const level = member?.level ?? 1
  const index = levels.data?.findIndex((l) => l.level === level) ?? -1
  const current = index >= 0 ? levels.data?.[index] : undefined
  const next = index >= 0 ? levels.data?.[index + 1] : undefined
  const experience = member?.experience ?? 0
  const needed = current?.xp_to_level_up ?? 0
  const progress = needed > 0 ? Math.min(100, (experience / needed) * 100) : 0

  async function handleSave(event: FormEvent) {
    event.preventDefault()
    await run(
      (wallet, permission) => saveSettingsActions(wallet, permission, tag.trim(), freeCpu),
      'Settings updated successfully',
      () => queryClient.invalidateQueries({ queryKey: playerKeys.member(account) })
    )
  }

  return (
    <>
      <PageHeader title="User Area" image={publicUrl('/assets/background/bg-user-area.webp')} />

      <div className="page settings">
        <section className="panel settings__mining">
          <div className="panel__head">
            <h2 className="panel__title">Mining button type in header</h2>
          </div>
          <MiningTypePicker />
        </section>

        <form className="panel settings__user" onSubmit={handleSave}>
          <div className="panel__head">
            <h2 className="panel__title">User Settings</h2>
          </div>

          <fieldset disabled={!canEdit || saving} className="settings__fields">
            <label className="field">
              <span className="field__label">Player Tag</span>
              <input className="input field__input" value={tag} maxLength={12} onChange={(e) => setTag(e.target.value)} />
            </label>

            <label className="switch">
              <input type="checkbox" checked={freeCpu} onChange={(e) => setFreeCpu(e.target.checked)} />
              <span className="switch__track" aria-hidden>
                <span className="switch__thumb" />
              </span>
              <span>Help Mission control run smoothly, receive CPU in return</span>
            </label>

            <Button type="submit" isLoading={saving} disabled={!canEdit || saving}>
              Save
            </Button>
          </fieldset>
        </form>

        <section className="panel settings__level">
          <div className="panel__head">
            <h2 className="panel__title">Player Level</h2>
          </div>

          <dl className="level-grid">
            <div>
              <dt>Current Level</dt>
              <dd className="num">{level}</dd>
            </div>
            <div>
              <dt>Questing Multiplier</dt>
              <dd className="num">{Number(current?.quest_power ?? 0).toFixed(2)}</dd>
            </div>
            <div>
              <dt>Next Level</dt>
              <dd className="num">{level + 1}</dd>
            </div>
            <div>
              <dt>Questing Multiplier</dt>
              <dd className="num">{Number(next?.quest_power ?? 0).toFixed(2)}</dd>
            </div>
          </dl>

          <div className="level-xp">
            <span className="num">
              {experience}/{needed} experience to level up
            </span>
            <span className="progress" role="progressbar" aria-valuenow={experience} aria-valuemax={needed}>
              <span style={{ width: `${progress}%` }} />
            </span>
          </div>
        </section>

        <section className="panel settings__network">
          <div className="panel__head">
            <h2 className="panel__title">API Endpoint</h2>
            <NetworkStatus />
          </div>
        </section>
      </div>
    </>
  )
}
