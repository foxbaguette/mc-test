import { useEffect, useState } from 'react'

import { reprobe } from '@/state/useNetwork'
import { publicUrl } from '@/lib/publicUrl'
import { Button } from './Button'

import './Loading.css'

const planets = ['eyeke', 'magor', 'veles', 'naron', 'neri', 'kavian']

export function Loading() {
  const [slow, setSlow] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), 10_000)
    return () => clearTimeout(timer)
  }, [])

  async function handleReload() {
    // Re-rank the nodes first so the reload starts on the ones answering now.
    await reprobe().catch(() => undefined)
    window.location.reload()
  }

  return (
    <div className="loading" role="status" aria-live="polite">
      <div className="loading__planets" aria-hidden>
        {planets.map((planet) => (
          <img key={planet} src={publicUrl(`/assets/planets/${planet}.png`)} alt="" />
        ))}
      </div>

      <h2 className="loading__title">{slow ? 'IS THIS PROCESS TAKING LONGER THAN USUAL?' : 'LOADING DATA...'}</h2>

      {slow && (
        <Button size="lg" pill onClick={handleReload}>
          YES, RELOAD!
        </Button>
      )}
    </div>
  )
}
