import { useMemo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'

import { RARITY_ORDER } from '@/chain/config'
import { Button } from '@/components/Button'
import { MiningBlocked } from '@/components/MiningBlocked'
import { RefreshIcon } from '@/icons/ui'
import { useEquippedTools } from '@/data/mining'
import { loanCooldownSeconds, refreshToolLoaning, useLoanableTools, useLoanLand, type LoanTool } from '@/data/toolLoaning'
import PersonSVG from '@/icons/person'
import SettingsSVG from '@/icons/settings'
import { cooldownLabel, useClockFor } from '@/lib/time'
import { Ticking } from '@/components/Ticking'
import { mineWithLoanedTool } from '@/mining/loan'
import { useCanMine, useSession } from '@/state/session'

import { ToolCard, ToolStats } from './Shared'

export function Mine() {
  const { account, permission } = useSession(useShallow((s) => ({ account: s.account, permission: s.permission })))
  const loan = useLoanableTools(account)
  const equipped = useEquippedTools(account)
  const landFor = useLoanLand()
  // Re-render when a tool becomes ready, to re-sort; the countdowns tick on their own.
  const now = useClockFor(loan.tools.map((tool) => tool.readyAt))
  const [mining, setMining] = useState<number | null>(null)
  const canMine = useCanMine()

  // What can be mined with right now comes first, then the rarest and the strongest.
  const tools = useMemo(
    () =>
      [...loan.tools].sort(
        (a, b) =>
          Number(b.readyAt <= now) - Number(a.readyAt <= now) ||
          (RARITY_ORDER[a.rarity] ?? 99) - (RARITY_ORDER[b.rarity] ?? 99) ||
          b.mining_power + b.nft_power - (a.mining_power + a.nft_power) ||
          a.tool_name.localeCompare(b.tool_name)
      ),
    [loan.tools, now]
  )
  const ready = tools.filter((tool) => tool.readyAt <= now).length

  async function handleMine(tool: LoanTool) {
    if (!account) return
    setMining(tool.template_id)
    await mineWithLoanedTool({
      account,
      permission,
      tool,
      bagIds: (equipped.data ?? []).map((t) => t.asset_id),
      landId: landFor(tool)
    })
    setMining(null)
  }

  return (
    <section className="tl-section">
      <MiningBlocked />
      <div className="tl-section__head">
        <h2 className="tl-section__title">
          LOAN TOOLS
          {!loan.isLoading && tools.length > 0 && (
            <span className="tl-section__count num">
              {ready}/{tools.length} ready
            </span>
          )}
        </h2>
        <button
          className={`icon-btn ${loan.isFetching ? 'is-spinning' : ''}`}
          onClick={() => refreshToolLoaning(account)}
          disabled={loan.isFetching}
          aria-label="Refresh"
        >
          <RefreshIcon />
        </button>
      </div>

      <div className="tl-grid">
        {loan.isLoading ? (
          Array.from({ length: 8 }, (_, i) => <div key={i} className="skeleton tl-card__loading" />)
        ) : tools.length === 0 ? (
          <p className="empty">No tools</p>
        ) : (
          tools.map((tool) => {
            const isReady = tool.readyAt <= now
            return (
              <ToolCard
                key={tool.template_id}
                templateId={tool.template_id}
                name={tool.tool_name}
                rarity={tool.rarity}
                shine={tool.shine}
                owned={tool.owned}
                ready={isReady}
                stats={<ToolStats power={tool.mining_power} nftPower={tool.nft_power} cooldown={loanCooldownSeconds(tool)} />}
              >
                <Button
                  block
                  size="sm"
                  color={isReady ? 'gradientYellow' : 'solidBlue'}
                  isLoading={mining === tool.template_id}
                  disabled={!canMine || mining !== null || !isReady}
                  onClick={() => handleMine(tool)}
                >
                  {isReady ? (
                    'Mine'
                  ) : (
                    <>
                      {/* Whose clock is still running: the player's own, or this tool's. */}
                      {tool.blockedBy === 'miner' ? <PersonSVG /> : <SettingsSVG />}
                      <span className="num">
                        <Ticking render={(tick) => cooldownLabel(tool.readyAt, tick)} />
                      </span>
                    </>
                  )}
                </Button>
              </ToolCard>
            )
          })
        )}
      </div>
    </section>
  )
}
