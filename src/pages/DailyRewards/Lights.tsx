import type { CSSProperties } from 'react'

/** How many bulbs sit around the rim. */
const BULBS = 24
/** How many sparks fly on a win. */
const SPARKS = 18

export type LightsMode = 'idle' | 'spinning' | 'won'

/**
 * Bulbs around the wheel's rim, like a game-show wheel: a slow twinkle while it waits, a chase
 * while it spins, and a flash in the prize's colour when it lands. Decoration only.
 */
export function WheelLights({ mode, color }: { mode: LightsMode; color?: string }) {
  return (
    <div className={`wheel-lights is-${mode}`} style={color ? ({ '--win': color } as CSSProperties) : undefined} aria-hidden>
      {Array.from({ length: BULBS }, (_, i) => (
        <span
          key={i}
          className="wheel-lights__arm"
          style={{ '--i': i, '--n': BULBS, transform: `rotate(${(i * 360) / BULBS}deg)` } as CSSProperties}
        >
          <span className="wheel-lights__bulb" />
        </span>
      ))}
    </div>
  )
}

/** A burst of sparks in the prize's colour from the pointer, once, when the wheel lands. */
export function WinSparks({ color, burst }: { color: string; burst: number }) {
  return (
    // Keyed by the burst, so each win plays it afresh.
    <div key={burst} className="win-sparks" style={{ '--win': color } as CSSProperties} aria-hidden>
      {Array.from({ length: SPARKS }, (_, i) => {
        // Fanned out below the pointer, a little uneven so it doesn't look stamped.
        const angle = 200 + (i / (SPARKS - 1)) * 140 + ((i * 37) % 11) - 5
        const distance = 70 + ((i * 53) % 60)
        return (
          <span
            key={i}
            className="win-sparks__spark"
            style={
              {
                '--dx': `${Math.cos((angle * Math.PI) / 180) * distance}px`,
                '--dy': `${-Math.sin((angle * Math.PI) / 180) * distance}px`,
                '--delay': `${(i % 4) * 40}ms`
              } as CSSProperties
            }
          />
        )
      })}
    </div>
  )
}
