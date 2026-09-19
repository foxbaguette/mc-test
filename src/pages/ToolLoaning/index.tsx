import { useState } from 'react'

import { PageHeader } from '@/components/PageHeader'
import { publicUrl } from '@/lib/publicUrl'

import { Config } from './Config'
import { Lend } from './Lend'
import { Mine } from './Mine'
import { Wallet } from './Wallet'

import './ToolLoaning.css'

type View = 'mine' | 'lend' | 'config'

/** Borrow a tool, lend yours out, or pick which tools the header's Mine button may use. */
const VIEWS: { value: View; label: string }[] = [
  { value: 'mine', label: 'Mine' },
  { value: 'lend', label: 'Stake' },
  { value: 'config', label: 'Loaning Config' }
]

export default function ToolLoaning() {
  const [view, setView] = useState<View>('mine')

  return (
    <>
      <PageHeader title="Tool Loaning" image={publicUrl('/assets/background/bg-tool-loaning.webp')} />

      <div className="page loaning plates">
        <Wallet />

        <div className="loaning__nav">
          <div className="segmented" role="tablist" aria-label="Tool Loaning">
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

        {view === 'mine' && <Mine />}
        {view === 'lend' && <Lend />}
        {view === 'config' && <Config />}
      </div>
    </>
  )
}
