import { Button } from '@/components/Button'
import { RefreshIcon } from '@/components/icons'
import { useMembership } from '@/data/player'
import { useMining } from '@/mining/useMining'

/**
 * The top bar's mine button. Its own component because it ticks every second with the
 * cooldown: only this part of the bar re-renders, not the balances or the account menu.
 */
export function MineWidget() {
  const { isFullMember } = useMembership()
  const mining = useMining()

  return (
    <div className="mine" aria-live="polite">
      <button
        className={`icon-btn mine__refresh ${mining.isRefreshing ? 'is-spinning' : ''}`}
        disabled={!isFullMember}
        onClick={mining.refresh}
        aria-label="Refresh"
      >
        <RefreshIcon size={20} />
      </button>
      <div className="mine__body">
        <span className="mine__above">{mining.textAbove}</span>
        <Button
          className={`mine__button ${mining.isReady ? 'btn--charged btn--soft is-ready' : ''}`}
          onClick={mining.onClick}
          disabled={mining.isDisabled}
          color={mining.buttonColor}
          isLoading={mining.isBusy}
        >
          <span className="num">{mining.buttonText}</span>
        </Button>
        <span className="mine__below" title={mining.textBelow}>
          {mining.textBelow}
        </span>
      </div>
    </div>
  )
}
