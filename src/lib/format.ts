import { publicUrl } from '@/lib/publicUrl'

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** 1234 -> "1.2 k", same compact style as the original header. */
export function formatCompact(value: number, decimals = 1): string {
  const suffixes = ['', 'k', 'M', 'B', 'T']
  let magnitude = 0
  let scaled = value
  while (scaled >= 1000 && magnitude < suffixes.length - 1) {
    scaled /= 1000
    magnitude++
  }
  const fixed = value > 999 ? scaled.toFixed(decimals) : Math.floor(value)
  return `${fixed} ${suffixes[magnitude]}`
}

export function formatAmount(value: number, maximumFractionDigits = 2): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits }).format(value)
}

export function tlmToNumber(value?: string | null): number {
  return Number(String(value ?? '0').replace(/\s*TLM$/, '')) || 0
}

export const planetImage = (planet?: string) => publicUrl(`/assets/planets/${String(planet ?? '').toLowerCase()}.png`)
export const landImage = (land?: string) => publicUrl(`/assets/lands/${land}.webp`)
