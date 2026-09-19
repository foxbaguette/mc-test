import { useState } from 'react'
import { Navigate } from 'react-router-dom'

import { PageHeader } from '@/components/PageHeader'
import { usePdMember } from '@/data/planetaryDefense'
import { publicUrl } from '@/lib/publicUrl'
import { useAccount } from '@/state/session'

import { AttackMission, LandDefense } from './Missions'
import { Pvp } from './Pvp'
import { PlayerStats } from './Stats'

import './PlanetaryDefense.css'

type View = 'missions' | 'stats' | 'pvp'

const VIEWS: { value: View; label: string }[] = [
  { value: 'missions', label: 'Missions' },
  { value: 'stats', label: 'Player Stats' },
  { value: 'pvp', label: 'PvP' }
]

/** Planetary Defense (magordefense): attack missions, land defense, player stats and PvP. For players with an account there. */
export default function PlanetaryDefense() {
  const account = useAccount()
  const member = usePdMember(account)
  const [view, setView] = useState<View>('missions')

  // The menu only offers this page to Planetary Defense players; anyone else who lands here goes home.
  if (member.isFetched && !member.data) return <Navigate to="/menu" replace />

  return (
    <>
      <PageHeader title="Planetary Defense" image={publicUrl('/assets/background/bg-login.webp')} />

      <div className="page pd plates">
        <div className="pd__nav">
          <div className="segmented" role="tablist" aria-label="Planetary Defense">
            {VIEWS.map((v) => (
              <button
                key={v.value}
                role="tab"
                aria-selected={view === v.value}
                className={view === v.value ? 'is-active' : ''}
                onClick={() => setView(v.value)}
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>

        {!member.isFetched ? (
          <div className="skeleton pd-card--skeleton" />
        ) : view === 'missions' ? (
          <div className="pd-grid">
            <AttackMission />
            <LandDefense />
          </div>
        ) : view === 'stats' ? (
          <PlayerStats />
        ) : (
          <Pvp />
        )}
      </div>
    </>
  )
}
