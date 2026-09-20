import { Button } from '@/components/Button'
import TLMSVG from '@/icons/tlm'
import { ArrowUpIcon, RefreshIcon } from '@/icons/ui'
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
        <span className={`mine__above ${mining.estimatedTlm !== null ? 'has-estimate' : ''}`}>
          <span className="mine__mode">{mining.textAbove}</span>
          {mining.estimatedTlm !== null && (
            <span className="mine__estimate num" title="Estimated TLM for the next mine, on the current pools">
              ≈ {mining.estimatedTlm.toFixed(4)} <TLMSVG />
            </span>
          )}
        </span>
        <Button
          className={`mine__button ${mining.isReady ? 'btn--charged btn--soft is-ready' : ''}`}
          onClick={mining.onClick}
          disabled={mining.isDisabled}
          color={mining.buttonColor}
          isLoading={mining.isBusy}
        >
          <span className="num">{mining.buttonText}</span>
        </Button>
        <span className="mine__below">
          <span className="mine__land" title={mining.textBelow}>
            {mining.textBelow}
          </span>
          {mining.upgrade && (
            <span className="mine__upgrade num" title={mining.upgrade.title}>
              <ArrowUpIcon size={10} /> {mining.upgrade.in}
            </span>
          )}
        </span>
      </div>
    </div>
  )
}
