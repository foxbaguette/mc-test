import { useEffect, useRef, useState } from 'react'

export interface WheelSegment {
  id: number
  label: string
  color: string
  weight: number
  fontSize: number
}

interface WheelProps {
  segments: WheelSegment[]
  /** Index of the segment to land on while `spinning` is true. */
  target: number
  spinning: boolean
  onStop: () => void
}

const SIZE = 400
const R = SIZE / 2
const RIM = 14
const FACE = R - RIM
const SPIN_MS = 11_000

function polar(angle: number, radius: number) {
  const rad = ((angle - 90) * Math.PI) / 180
  return [R + radius * Math.cos(rad), R + radius * Math.sin(rad)]
}

/** Prize wheel drawn as SVG; the pointer sits at the top, so a segment lands at 0°. */
export function Wheel({ segments, target, spinning, onStop }: WheelProps) {
  const [rotation, setRotation] = useState(0)
  const stopRef = useRef(onStop)
  stopRef.current = onStop

  const total = segments.reduce((sum, s) => sum + s.weight, 0) || 1
  let cursor = 0
  const arcs = segments.map((segment) => {
    const start = (cursor / total) * 360
    cursor += segment.weight
    const end = (cursor / total) * 360
    return { ...segment, start, end }
  })

  useEffect(() => {
    if (!spinning || !arcs[target]) return
    const arc = arcs[target]
    // Land somewhere inside the segment, never on its edge.
    const inside = arc.start + (arc.end - arc.start) * (0.25 + Math.random() * 0.5)
    // Rotate so that `inside` ends up under the pointer at the top, plus several full turns.
    setRotation((current) => {
      const base = current - (current % 360)
      return base + 360 * 6 + ((360 - inside) % 360)
    })
    const timer = setTimeout(() => stopRef.current(), SPIN_MS)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spinning, target])

  return (
    <svg
      className="wheel"
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      style={{ transform: `rotate(${rotation}deg)`, transitionDuration: spinning ? `${SPIN_MS}ms` : '0ms' }}
      role="img"
      aria-label="Daily rewards wheel"
    >
      <defs>
        {/* Light from the top left, so the face reads as a disc rather than a pie chart. */}
        <radialGradient id="wheel-shade" cx="32%" cy="24%" r="78%">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.22" />
          <stop offset="55%" stopColor="#fff" stopOpacity="0" />
          <stop offset="100%" stopColor="#000" stopOpacity="0.45" />
        </radialGradient>
      </defs>

      <circle cx={R} cy={R} r={FACE} fill="#0a1626" />

      {arcs.map((arc) => {
        const [x1, y1] = polar(arc.start, FACE)
        const [x2, y2] = polar(arc.end, FACE)
        const large = arc.end - arc.start > 180 ? 1 : 0
        const mid = (arc.start + arc.end) / 2
        const [tx, ty] = polar(mid, FACE * 0.66)
        return (
          <g key={`${arc.id}-${arc.start}`}>
            <path
              d={`M${R},${R} L${x1},${y1} A${FACE},${FACE} 0 ${large} 1 ${x2},${y2} Z`}
              fill={arc.color}
              stroke="rgba(5, 16, 30, 0.65)"
              strokeWidth="1.5"
            />
            <text
              x={tx}
              y={ty}
              fill="#fff"
              fontSize={arc.fontSize}
              fontFamily="var(--font-heading)"
              fontWeight={700}
              textAnchor="middle"
              dominantBaseline="middle"
              /* Radial labels: outward on the right half, flipped on the left so none reads upside down. */
              transform={`rotate(${mid > 180 ? mid + 90 : mid - 90} ${tx} ${ty})`}
            >
              {arc.label}
            </text>
          </g>
        )
      })}

      <circle cx={R} cy={R} r={FACE} fill="url(#wheel-shade)" pointerEvents="none" />
    </svg>
  )
}

/** The parts that never turn: the rim, its lighting and the hub. */
export function WheelRim() {
  return (
    <svg className="wheel-rim" viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden>
      <defs>
        <linearGradient id="rim-metal" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3d5f80" />
          <stop offset="45%" stopColor="#16283e" />
          <stop offset="100%" stopColor="#0a1524" />
        </linearGradient>
        <linearGradient id="rim-light" x1="0" y1="0" x2="0.6" y2="1">
          <stop offset="0%" stopColor="#7fdcff" stopOpacity="0.85" />
          <stop offset="40%" stopColor="#7fdcff" stopOpacity="0.1" />
          <stop offset="100%" stopColor="#ff8bf5" stopOpacity="0.5" />
        </linearGradient>
      </defs>

      <circle cx={R} cy={R} r={R - RIM / 2} fill="none" stroke="url(#rim-metal)" strokeWidth={RIM} />
      <circle cx={R} cy={R} r={R - RIM / 2} fill="none" stroke="url(#rim-light)" strokeWidth="1.5" />
      <circle cx={R} cy={R} r={FACE} fill="none" stroke="rgba(0, 0, 0, 0.55)" strokeWidth="2" />

      {/* Hub */}
      <circle cx={R} cy={R} r="30" fill="#0d1c2e" stroke="url(#rim-metal)" strokeWidth="6" />
      <circle cx={R} cy={R} r="24" fill="none" stroke="rgba(127, 220, 255, 0.35)" strokeWidth="1.5" />
      <circle cx={R} cy={R} r="7" fill="rgba(127, 220, 255, 0.55)" />
    </svg>
  )
}
