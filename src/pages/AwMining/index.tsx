import { useState } from 'react'
import { Link } from 'react-router-dom'

import { PageHeader } from '@/components/PageHeader'
import { publicUrl } from '@/lib/publicUrl'

import { Favorites } from './Favorites'
import { Main } from './Main'
import { Selection } from './Selection'

import '../Questing.css'
import './AwMining.css'

export type MiningView = 'main' | 'selection' | 'favorites'

const VIEWS: { value: MiningView; label: string }[] = [
  { value: 'main', label: 'Current Selection' },
  { value: 'selection', label: 'Land Selection' },
  { value: 'favorites', label: 'Favorites' }
]

export default function AwMining() {
  const [view, setView] = useState<MiningView>('main')

  return (
    <>
      <PageHeader title="Alien Worlds Mining" image={publicUrl('/assets/background/bg-aw-mining.webp')} />

      <div className="page mining">
        <div className="mining__nav">
          <div className="segmented" role="tablist">
            {VIEWS.map((v) => (
              <button key={v.value} role="tab" aria-selected={view === v.value} className={view === v.value ? 'is-active' : ''} onClick={() => setView(v.value)}>
                {v.label}
              </button>
            ))}
          </div>
          <Link to="/tool-tactician" className="mining__tactician">
            Tool Tactician →
          </Link>
        </div>

        {view === 'main' && <Main />}
        {view === 'selection' && <Selection />}
        {view === 'favorites' && <Favorites />}
      </div>
    </>
  )
}
