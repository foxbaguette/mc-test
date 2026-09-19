import type { ReactNode } from 'react'

/** A readout: a quiet label over the figure. */
export function Plate({ label, value, icon, accent }: { label: string; value: ReactNode; icon?: ReactNode; accent?: boolean }) {
  return (
    <div className={`pd-plate ${accent ? 'is-accent' : ''}`}>
      <span className="pd-plate__label">{label}</span>
      <span className="pd-plate__value num">
        {value}
        {icon}
      </span>
    </div>
  )
}

/** Progress toward a target, with the figures and the share done. */
export function Meter({ value, max, tone }: { value: number; max: number; tone: 'attack' | 'defense' }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  return (
    <div className={`pd-meter pd-meter--${tone}`}>
      <div className="pd-meter__figures num">
        <span>
          {value.toLocaleString('en-US')} <small>/ {max.toLocaleString('en-US')}</small>
        </span>
        <strong>{pct.toFixed(pct >= 10 ? 0 : 1)}%</strong>
      </div>
      <span className="pd-meter__bar" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={max}>
        <span style={{ width: `${pct}%` }} />
      </span>
    </div>
  )
}
