import { useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'

import { RARITY_ORDER } from '@/chain/config'
import { Button } from '@/components/Button'
import { WarningCircleIcon } from '@/icons/ui'
import { useToolInventory } from '@/data/mining'
import { SHINE_ORDER, useStakedTools, useToolOv } from '@/data/toolLoaning'
import { chainDate, formatDateNumeric } from '@/lib/time'
import { stakeToolsAction, unstakeToolsAction } from '@/chain/actions/toolLoaning'
import { useTransaction } from '@/wallet/useTransaction'
import { miningKeys, toolLoaningKeys } from '@/data/keys'

import { ToolCard, ToolStats } from './Shared'

/** Both sides of lending in one place: what is staked now, and what could be. */
export function Lend() {
  const queryClient = useQueryClient()
  const { run, busy, account } = useTransaction()
  const inventory = useToolInventory(account)
  const staked = useStakedTools(account)
  const toolOv = useToolOv()
  const [pending, setPending] = useState<string | null>(null)

  const invalidate = (...keys: (readonly unknown[])[]) =>
    Promise.all(keys.map((queryKey) => queryClient.invalidateQueries({ queryKey })))

  const stakeable = useMemo(
    () =>
      (inventory.data ?? [])
        .flatMap((asset) => {
          const ov = toolOv.data?.find((tool) => tool.template_id === Number(asset.template?.template_id) && tool.allowed === 1)
          return ov ? [{ asset, ov }] : []
        })
        .sort(
          (a, b) =>
            (RARITY_ORDER[a.ov.rarity] ?? 99) - (RARITY_ORDER[b.ov.rarity] ?? 99) ||
            b.ov.mining_power + b.ov.nft_power - (a.ov.mining_power + a.ov.nft_power) ||
            (SHINE_ORDER[a.ov.shine] ?? 9) - (SHINE_ORDER[b.ov.shine] ?? 9)
        ),
    [inventory.data, toolOv.data]
  )

  const mine = useMemo(
    () =>
      (staked.data ?? [])
        .filter((tool) => tool.owned > 0)
        .map((tool) => ({ tool, ov: toolOv.data?.find((ov) => ov.template_id === tool.template_id) }))
        .sort(
          (a, b) =>
            (RARITY_ORDER[a.ov?.rarity ?? ''] ?? 99) - (RARITY_ORDER[b.ov?.rarity ?? ''] ?? 99) ||
            (b.ov?.mining_power ?? 0) + (b.ov?.nft_power ?? 0) - ((a.ov?.mining_power ?? 0) + (a.ov?.nft_power ?? 0)) ||
            (SHINE_ORDER[a.ov?.shine ?? ''] ?? 9) - (SHINE_ORDER[b.ov?.shine ?? ''] ?? 9)
        ),
    [staked.data, toolOv.data]
  )

  async function stake(assetId: string) {
    setPending(assetId)
    await run(
      (a, p) => stakeToolsAction(a, p, [assetId]),
      'Tool staked',
      () => invalidate(miningKeys.toolInventory(account), toolLoaningKeys.toolOv, toolLoaningKeys.stakedTools(account))
    )
    setPending(null)
  }

  async function unstake(assetId: string) {
    setPending(assetId)
    await run(
      (a, p) => unstakeToolsAction(a, p, [assetId]),
      'Tool unstaked',
      () =>
        invalidate(
          toolLoaningKeys.stakedTools(account),
          toolLoaningKeys.toolOv,
          toolLoaningKeys.toolWallet(account),
          miningKeys.toolInventory(account)
        )
    )
    setPending(null)
  }

  return (
    <>
      <p className="tl-hint">
        <WarningCircleIcon size={20} color="var(--blue)" />
        Going to bed? Excess tools? Not there for a weekend or even on vacation? Stake your tools to Mission Control where other
        players can mine with them. The mined TLM is split between you (the lender), the miner (the borrower) and Mission Control
        (facilitator and CPU provider).
      </p>

      {(staked.isLoading || mine.length > 0) && (
        <section className="tl-section">
          <h2 className="tl-section__title">YOUR STAKED TOOLS</h2>
          <div className="tl-grid">
            {staked.isLoading
              ? Array.from({ length: 3 }, (_, i) => <div key={i} className="skeleton tl-card__loading" />)
              : mine.map(({ tool, ov }) => (
                  <ToolCard
                    key={tool.asset_id}
                    templateId={tool.template_id}
                    name={ov?.tool_name ?? String(tool.template_id)}
                    rarity={ov?.rarity ?? ''}
                    shine={ov?.shine}
                    stats={
                      <dl className="tl-meta">
                        <div>
                          <dt>Since</dt>
                          <dd className="num">{formatDateNumeric(chainDate(tool.stakedat))}</dd>
                        </div>
                        <div>
                          <dt>Total</dt>
                          <dd className="num">{tool.total_earned}</dd>
                        </div>
                        <div>
                          <dt>Uses</dt>
                          <dd className="num">{tool.total_mines}</dd>
                        </div>
                      </dl>
                    }
                  >
                    <Button
                      block
                      size="sm"
                      color="ghost"
                      isLoading={pending === tool.asset_id}
                      disabled={busy}
                      onClick={() => unstake(tool.asset_id)}
                    >
                      Unstake
                    </Button>
                  </ToolCard>
                ))}
          </div>
        </section>
      )}

      <section className="tl-section">
        <h2 className="tl-section__title">EARN PASSIVE TLM FROM STAKING YOUR TOOLS WHILE YOU DO NOT USE THEM</h2>
        <div className="tl-grid">
          {inventory.isLoading || toolOv.isLoading ? (
            Array.from({ length: 6 }, (_, i) => <div key={i} className="skeleton tl-card__loading" />)
          ) : stakeable.length === 0 ? (
            <p className="empty">No tools</p>
          ) : (
            stakeable.map(({ asset, ov }) => (
              <ToolCard
                key={asset.asset_id}
                templateId={ov.template_id}
                name={ov.tool_name}
                rarity={ov.rarity}
                shine={ov.shine}
                stats={<ToolStats power={ov.mining_power} nftPower={ov.nft_power} cooldown={ov.cooldown_seconds} />}
                note={`Gain ${ov.owner_share / 10}% of all TLM mined with this tool.`}
              >
                <Button
                  block
                  size="sm"
                  isLoading={pending === asset.asset_id}
                  disabled={busy}
                  onClick={() => stake(asset.asset_id)}
                >
                  Stake
                </Button>
              </ToolCard>
            ))
          )}
        </div>
      </section>
    </>
  )
}
