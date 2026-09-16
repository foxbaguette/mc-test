import { useEffect, useState } from 'react'

/** Chain timestamps come without a zone suffix but are UTC. */
export function chainDate(value?: string | number | null): Date {
  if (value === undefined || value === null || value === '') return new Date(NaN)
  if (typeof value === 'number') return new Date(value)
  return new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(value) ? value : `${value}Z`)
}

export interface TimeLeft {
  days: number
  hours: number
  minutes: number
  seconds: number
  ms: number
}

export function timeLeft(target: Date | number, now = Date.now()): TimeLeft {
  const ms = Math.max(0, +target - now)
  return {
    days: Math.floor(ms / 86_400_000),
    hours: Math.floor((ms / 3_600_000) % 24),
    minutes: Math.floor((ms / 60_000) % 60),
    seconds: Math.floor((ms / 1000) % 60),
    ms
  }
}

const pad = (n: number) => String(n).padStart(2, '0')

/** "MINE" once ready, otherwise "mm:ss" or "hh:mm:ss" like the original button. */
export function cooldownLabel(target: Date | number, now = Date.now(), ready = 'MINE'): string {
  const t = timeLeft(target, now)
  if (t.ms <= 0) return ready
  const totalHours = t.days * 24 + t.hours
  return totalHours > 0 ? `${pad(totalHours)}:${pad(t.minutes)}:${pad(t.seconds)}` : `${pad(t.minutes)}:${pad(t.seconds)}`
}

/** "2d 4h", "4h 12m", "12m 30s" or "30s": the two units that matter at that scale. */
export function shortDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000))
  const days = Math.floor(total / 86_400)
  const hours = Math.floor((total / 3_600) % 24)
  const minutes = Math.floor((total / 60) % 60)
  const seconds = total % 60
  if (days) return `${days}d ${hours}h`
  if (hours) return `${hours}h ${minutes}m`
  if (minutes) return `${minutes}m ${seconds}s`
  return `${seconds}s`
}

export function durationLabel(target: Date | number, now = Date.now()): string {
  const t = timeLeft(target, now)
  let out = ''
  if (t.days) out += `${t.days}d `
  if (t.hours) out += `${t.hours}h `
  if (t.minutes) out += `${t.minutes}m `
  return out.trim()
}

/** Re-renders the caller every `intervalMs` and returns the current time. */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const MONTHS_SHORT = MONTHS.map((m) => m.slice(0, 3))

/** "05 March 2025 14:02" */
export function formatDateTime(date: Date): string {
  return `${pad(date.getDate())} ${MONTHS[date.getMonth()]} ${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** "05 March 2025" */
export function formatDate(date: Date): string {
  return `${pad(date.getDate())} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`
}

/** "05 Mar 2025 14:02" */
export function formatDateTimeShort(date: Date): string {
  return `${pad(date.getDate())} ${MONTHS_SHORT[date.getMonth()]} ${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}
