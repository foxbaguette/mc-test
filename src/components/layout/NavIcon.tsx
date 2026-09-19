import { useId, type CSSProperties, type ReactNode } from 'react'

import './NavIcon.css'

/**
 * How the section icons are dressed. One switch for the whole menu: the look lives in NavIcon.css
 * under .nav-icon--<style>, so trying another style means a new CSS block and this constant.
 */
const STYLE = 'hex'

interface NavIconProps {
  /** The section's colour: frame, glow and (unless `multicolor`) the glyph's gradient. */
  color: string
  /** Glyph colour when it differs from the frame, e.g. the white Builder crane. */
  glyph?: string
  /** Icons drawn in several colours keep them; only single-colour glyphs get the gradient. */
  multicolor?: boolean
  children: ReactNode
}

export function NavIcon({ color, glyph = color, multicolor = false, children }: NavIconProps) {
  const id = `nav-grad-${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  const style = {
    '--c': color,
    '--lt': shade(color, 14),
    '--dk': shade(color, -22),
    '--g': `url(#${id})`
  } as CSSProperties

  return (
    <span className={`nav-icon nav-icon--${STYLE} ${multicolor ? '' : 'is-mono'}`} style={style} aria-hidden>
      {!multicolor && (
        <svg className="nav-icon__defs" width="0" height="0">
          <defs>
            {/* Lit from above: lighter at the top, a shade deeper at the bottom. */}
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={shade(glyph, 18)} />
              <stop offset="0.55" stopColor={glyph} />
              <stop offset="1" stopColor={shade(glyph, -14)} />
            </linearGradient>
          </defs>
        </svg>
      )}
      <span className="nav-icon__glyph">{children}</span>
    </span>
  )
}

/** The colour `hex` with its lightness moved by `dl` percentage points. */
function shade(hex: string, dl: number): string {
  const n = parseInt(hex.slice(1), 16)
  const r = ((n >> 16) & 255) / 255
  const g = ((n >> 8) & 255) / 255
  const b = (n & 255) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  let h = 0
  let s = 0
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  }
  const light = Math.max(0, Math.min(100, l * 100 + dl))
  return `hsl(${Math.round(h * 60)} ${Math.round(s * 100)}% ${Math.round(light)}%)`
}
