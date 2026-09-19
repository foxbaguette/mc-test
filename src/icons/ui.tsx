/* UI glyphs (stroke or fill in currentColor). The coloured game icons live next to this file, one per file. */

type Props = { size?: number; color?: string; className?: string }

export function RefreshIcon({ size = 24, color = 'currentColor', className }: Props) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  )
}

export function InfoCircleIcon({ size = 24, color = 'currentColor', className }: Props) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill={color} aria-hidden>
      <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm1 15h-2v-6h2v6Zm0-8h-2V7h2v2Z" />
    </svg>
  )
}

export function WarningCircleIcon({ size = 100, color = '#fff', className }: Props) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 256 256"
      fill="none"
      stroke={color}
      strokeWidth="6"
      strokeLinecap="round"
      aria-hidden
    >
      <circle cx="128" cy="128" r="96" />
      <line x1="128" y1="80" x2="128" y2="136" />
      <circle cx="128" cy="172" r="5" fill={color} stroke="none" />
    </svg>
  )
}

export function ClockIcon({ size = 16, color = 'currentColor', className }: Props) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  )
}

export function LockIcon({ size = 18, color = 'currentColor', className }: Props) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden
    >
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  )
}

export function CheckSquareIcon({ size = 18, color = '#40D727', className }: Props) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <path d="m8 12 3 3 5-6" />
    </svg>
  )
}

export function HistoryIcon({ size = 18, color = 'currentColor', className }: Props) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
      <path d="M3 3v5h5" />
      <path d="M12 7v5l3 2" />
    </svg>
  )
}

export function ArrowLeftCircleIcon({ size = 30, color = '#fff', className }: Props) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 16 16" fill={color} aria-hidden>
      <path d="M8 0a8 8 0 1 0 0 16A8 8 0 0 0 8 0Zm3.5 7.5a.5.5 0 0 1 0 1H5.707l2.147 2.146a.5.5 0 0 1-.708.708l-3-3a.5.5 0 0 1 0-.708l3-3a.5.5 0 1 1 .708.708L5.707 7.5H11.5Z" />
    </svg>
  )
}

/*
 * Glyphs that were drawn inline in several places. Without `size` they take their size from the
 * surrounding CSS (e.g. `.icon-btn svg`), as the inline versions did.
 */
type GlyphProps = { size?: number; color?: string; strokeWidth?: number; className?: string }

const glyph = ({ size, className }: GlyphProps) => ({
  className,
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  'aria-hidden': true
})

/** ×: closing dialogs and sheets, or a "no" mark. */
export function CloseIcon({ color = 'currentColor', strokeWidth = 2, ...rest }: GlyphProps) {
  return (
    <svg {...glyph(rest)} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  )
}

/** ⋯: the More buttons. */
export function MoreIcon({ color = 'currentColor', ...rest }: GlyphProps) {
  return (
    <svg {...glyph(rest)} fill={color}>
      <circle cx="5" cy="12" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="19" cy="12" r="2" />
    </svg>
  )
}

/** A chevron pointing right (onward) or left (back). */
export function ChevronIcon({
  dir = 'right',
  color = 'currentColor',
  strokeWidth = 2.5,
  ...rest
}: GlyphProps & { dir?: 'left' | 'right' }) {
  return (
    <svg {...glyph(rest)} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round">
      <path d={dir === 'left' ? 'm15 6-6 6 6 6' : 'm9 6 6 6-6 6'} />
    </svg>
  )
}

export function GearIcon({ color = 'currentColor', strokeWidth = 1.8, ...rest }: GlyphProps) {
  return (
    <svg {...glyph(rest)} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
    </svg>
  )
}
