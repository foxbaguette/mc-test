import { useEffect, useState } from 'react'

import { WarningCircleIcon } from '@/components/icons'
import { useTips } from '@/data/queries'

/** Tips rotate on their own, one every ten seconds. */
const ROTATE_MS = 10_000

export function DidYouKnow() {
  const { data } = useTips()
  const [index, setIndex] = useState(0)

  useEffect(() => {
    const count = data?.length ?? 0
    if (count === 0) return
    // Start somewhere random, then walk through them in order.
    setIndex(Math.floor(Math.random() * count))
    const timer = setInterval(() => setIndex((current) => (current + 1) % count), ROTATE_MS)
    return () => clearInterval(timer)
  }, [data])

  const tip = data?.[index]?.description

  return (
    <section className="panel tip">
      <div className="panel__head">
        <h2 className="panel__title">DID YOU KNOW?</h2>
      </div>
      <div className="tip__body">
        <WarningCircleIcon size={22} color="var(--blue)" />
        {/* Keyed so each tip fades in as it appears. */}
        <p key={index} aria-live="polite">
          {tip}
        </p>
      </div>
    </section>
  )
}
