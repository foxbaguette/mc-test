import './Select.css'

export interface Option<V extends string = string> {
  value: V
  label: string
  /** Text colour for this entry in the open list. */
  color?: string
}

interface SelectProps<V extends string> {
  value: V
  options: Option<V>[]
  onChange: (value: V) => void
  className?: string
  /** Gradient border colors, like the original dropdown. */
  borderColors?: [string, string]
  ariaLabel?: string
}

export function Select<V extends string>({ value, options, onChange, className = '', borderColors, ariaLabel }: SelectProps<V>) {
  const style = borderColors
    ? ({ '--select-c1': borderColors[0], '--select-c2': borderColors[1] } as React.CSSProperties)
    : undefined

  return (
    <label className={`select ${className}`} style={style}>
      <select value={value} onChange={(e) => onChange(e.target.value as V)} aria-label={ariaLabel}>
        {options.map((option) => (
          <option key={option.value} value={option.value} style={option.color ? { color: option.color } : undefined}>
            {option.label}
          </option>
        ))}
      </select>
      <svg className="select__arrow" viewBox="0 0 24 24" aria-hidden>
        <path d="M3 5h18l-9 14z" fill="currentColor" />
      </svg>
    </label>
  )
}
