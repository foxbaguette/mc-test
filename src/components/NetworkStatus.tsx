import { useEffect, useRef, useState } from 'react'

import { reprobe, useNetwork } from '@/state/useNetwork'

import './NetworkStatus.css'

const host = (url: string) => url.replace(/^https?:\/\//, '')

/** Which WAX nodes answered this session, and how fast; reads rotate across the healthy ones. */
export function NetworkStatus() {
  const net = useNetwork()
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  const best = net.healthy[0]
  const label =
    net.state === 'probing' || net.state === 'idle'
      ? '…'
      : net.state === 'offline'
        ? 'Offline'
        : `${net.healthy.length}/${net.all.length} · ${Math.round(best?.latency ?? 0)}ms`

  return (
    <div ref={wrapRef} className="netstatus">
      <button
        type="button"
        className={`netdot netdot--${net.state}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        title="WAX nodes"
      >
        <span className="netdot__led" />
        <span>{label}</span>
      </button>

      {open && (
        <div className="netpop">
          <div className="netpop__head">
            <span>WAX nodes</span>
            <button type="button" onClick={() => void reprobe()} disabled={net.state === 'probing'}>
              {net.state === 'probing' ? '…' : 'Re-check'}
            </button>
          </div>
          <div className="netlist">
            {[...net.all]
              .sort((a, b) => a.latency - b.latency)
              .map((e) => (
                <div className="netlist__row" key={e.url}>
                  <span className={`netlist__led ${e.ok ? 'is-ok' : ''}`} />
                  <span className="netlist__host">{host(e.url)}</span>
                  <span className="netlist__ms">{e.ok ? `${Math.round(e.latency)}ms` : 'down'}</span>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  )
}
