import { useEffect, useRef, useState } from 'react'

import { Button } from '@/components/Button'
import { Modal } from '@/components/Modal'
import { formatR, refreshBuilder } from '@/data/builder'
import QuestSVG from '@/icons/quest'
import { qpFillStorageAction, qpToResourcesAction } from '@/chain/actions/builder'
import { useTransaction } from '@/wallet/useTransaction'

const SECONDS = 15

interface ConfirmDialogProps {
  qp: number
  resources: number
  fill: boolean
  onClose: () => void
}

/** Quest point exchange confirmation; the quote expires after 15 seconds, as before. */
export function ConfirmDialog({ qp, resources, fill, onClose }: ConfirmDialogProps) {
  const { run, busy } = useTransaction()
  const [left, setLeft] = useState(SECONDS)

  const closeRef = useRef(onClose)
  closeRef.current = onClose
  const busyRef = useRef(busy)
  busyRef.current = busy

  useEffect(() => {
    const started = Date.now()
    const id = setInterval(() => {
      const remaining = SECONDS - Math.floor((Date.now() - started) / 1000)
      // Don't pull the dialog away while the wallet is signing.
      if (remaining <= 0 && !busyRef.current) closeRef.current()
      else setLeft(Math.max(0, remaining))
    }, 250)
    return () => clearInterval(id)
  }, [])

  const minimum = resources * 0.95

  async function confirm() {
    const ok = await run(
      (a, p) => (fill ? qpFillStorageAction(a, p, qp) : qpToResourcesAction(a, p, qp, minimum)),
      fill ? 'Storage used successfully' : 'Purchase successful',
      refreshBuilder
    )
    if (ok) closeRef.current()
  }

  return (
    <Modal className="bdialog" locked={busy} onClose={() => closeRef.current()}>
      <div className="bdialog__body">
        <button className="icon-btn bdialog__close" onClick={() => closeRef.current()} disabled={busy} aria-label="Close">
          ×
        </button>
        <h2 className="bdialog__title">Confirm</h2>
        <p className="bdialog__qp num">
          <QuestSVG /> {qp}
        </p>
        <span className="bdialog__arrow" aria-hidden>
          ↓
        </span>
        <p className="bdialog__r num">
          <span>Я</span> {`> ${formatR(minimum)}`}
        </p>
        <p className="bdialog__desc">
          If the transaction would result <br /> in less <span>Я</span>, it is aborted.
        </p>
        <Button block isLoading={busy} disabled={busy} onClick={confirm}>
          <span className="num">Confirm ({String(left).padStart(2, '0')}s)</span>
        </Button>
      </div>
    </Modal>
  )
}
