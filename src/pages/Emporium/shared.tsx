import QuestSVG from '@/icons/quest'
import StarSVG from '@/icons/star'
import TLMSVG from '@/icons/tlm'
import { publicUrl } from '@/lib/publicUrl'

/** Icon for a task's currency: quest points, MC Points or TLM. */
export function CurrencyIcon({ type }: { type: string }) {
  if (type === 'qp') return <QuestSVG />
  if (type === 'mcp') return <StarSVG />
  return <TLMSVG />
}

export function TaskImage({ image, alt }: { image: string; alt: string }) {
  return (
    <img
      src={publicUrl(`/assets/tasks/${image}.jpeg`)}
      alt={alt}
      title={alt}
      loading="lazy"
      onError={(e) => {
        e.currentTarget.onerror = null
        e.currentTarget.src = publicUrl('/assets/background/bg-emporium.webp')
      }}
    />
  )
}
