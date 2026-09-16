import { useShallow } from 'zustand/react/shallow'
import { Button } from '@/components/Button'
import { COLORS } from '@/mining/useMining'
import { MINING_OPTIONS, useSession } from '@/state/session'

import './MiningTypePicker.css'

/** What the header's Mine button does, picked by looking at the button itself. */
export function MiningTypePicker() {
  const { miningType, setMiningType } = useSession(
    useShallow((s) => ({ miningType: s.miningType, setMiningType: s.setMiningType }))
  )

  return (
    <div className="mining-types" role="radiogroup" aria-label="Mining button type in header">
      {MINING_OPTIONS.map((option) => (
        <button
          key={option.value}
          role="radio"
          aria-checked={miningType === option.value}
          className={`mining-type ${miningType === option.value ? 'is-selected' : ''}`}
          onClick={() => setMiningType(option.value)}
        >
          <Button asSpan color={COLORS[option.value]} size="sm" className="mining-type__preview">
            MINE
          </Button>
          <span className="mining-type__label">{option.label}</span>
          <span className="mining-type__check" aria-hidden />
        </button>
      ))}
    </div>
  )
}
