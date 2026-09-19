import type { CSSProperties } from 'react'

import { publicUrl } from '@/lib/publicUrl'

import './Loading.css'

/** Eyeke at the centre, the other five on three orbits: radius and lap time as a share of the loader. */
const ORBITS = [
  { planets: ['magor'], radius: 0.25, seconds: 6 },
  { planets: ['veles', 'naron'], radius: 0.37, seconds: 11 },
  { planets: ['neri', 'kavian'], radius: 0.49, seconds: 18 }
]

export function Loading() {
  return (
    <div className="loading" role="status" aria-live="polite">
      <div className="loading__system" aria-hidden>
        {ORBITS.map(({ planets, radius, seconds }, orbit) => (
          <div key={orbit} className="loading__orbit" style={{ '--r': radius, '--lap': `${seconds}s` } as CSSProperties}>
            {planets.map((planet, i) => (
              <span
                key={planet}
                className="loading__arm"
                style={{ '--at': `${(360 / planets.length) * i + orbit * 70}deg` } as CSSProperties}
              >
                <img className="loading__planet" src={publicUrl(`/assets/planets/${planet}.png`)} alt="" />
              </span>
            ))}
          </div>
        ))}
        <img className="loading__core" src={publicUrl('/assets/planets/eyeke.png')} alt="" />
      </div>

      <div className="loading__label">
        <span>LOADING DATA...</span>
        <span className="loading__bar" />
      </div>
    </div>
  )
}
