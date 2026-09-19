import { useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'

import { RARITY_COLORS, RARITY_ORDER } from '@/chain/config'
import { Button } from '@/components/Button'
import { ClockIcon } from '@/icons/ui'
import { Select } from '@/components/Select'
import { loanCooldownSeconds, SHINE_ORDER, useToolOv, useToolWallet } from '@/data/toolLoaning'
import PickaxeSVG from '@/icons/pickaxe'
import ShardsSVG from '@/icons/shards'
import { setTempListAction } from '@/chain/actions/toolLoaning'
import { useTransaction } from '@/wallet/useTransaction'
import { publicUrl } from '@/lib/publicUrl'
import { toolLoaningKeys } from '@/data/keys'

type Sort = 'rarity' | 'name' | 'shine'

const SORTS: { value: Sort; label: string }[] = [
  { value: 'rarity', label: 'Sort by rarity' },
  { value: 'name', label: 'Sort by name' },
  { value: 'shine', label: 'Sort by shine' }
]

export function Config() {
  const queryClient = useQueryClient()
  const { run, busy, account } = useTransaction()
  const toolOv = useToolOv()
  const wallet = useToolWallet(account)
  const [sort, setSort] = useState<Sort>('rarity')
  const [checked, setChecked] = useState<number[] | null>(null)

  const allowed = useMemo(() => (toolOv.data ?? []).filter((tool) => tool.allowed === 1), [toolOv.data])

  // Start from the saved allow list; an empty list means every allowed tool is enabled.
  useEffect(() => {
    if (checked !== null || !toolOv.data || !wallet.isFetched) return
    const saved = wallet.data?.tempid_allow_list ?? []
    setChecked(saved.length > 0 ? saved : allowed.map((tool) => tool.template_id))
  }, [checked, toolOv.data, wallet.isFetched, wallet.data, allowed])

  const selected = checked ?? []

  const sorted = useMemo(
    () =>
      [...allowed].sort((a, b) => {
        const rarity = (RARITY_ORDER[a.rarity] ?? 99) - (RARITY_ORDER[b.rarity] ?? 99)
        const shine = (SHINE_ORDER[a.shine] ?? 9) - (SHINE_ORDER[b.shine] ?? 9)
        if (sort === 'name') return a.tool_name.localeCompare(b.tool_name)
        if (sort === 'shine') return shine || rarity
        return rarity || a.tool_name.localeCompare(b.tool_name) || shine
      }),
    [allowed, sort]
  )

  function toggle(templateId: number, on: boolean) {
    setChecked((prev) => {
      const list = prev ?? []
      return on ? [...list, templateId] : list.filter((id) => id !== templateId)
    })
  }

  function checkAll() {
    setChecked(selected.length === allowed.length ? [] : allowed.map((tool) => tool.template_id))
  }

  return (
    <section className="panel">
      <div className="panel__head">
        <h2 className="panel__title">ENABLE OR DISABLE TOOLS FOR USE WITH THE MINE BUTTON</h2>
      </div>

      <div className="config-toolbar">
        <Select value={sort} options={SORTS} onChange={setSort} borderColors={['#FFB31F', '#FFB31F']} ariaLabel="Sort" />
        <div className="config-toolbar__actions">
          <Button color="ghost" disabled={busy || allowed.length === 0} onClick={checkAll}>
            Check All
          </Button>
          <Button
            isLoading={busy}
            disabled={busy || checked === null}
            onClick={() =>
              run(
                (a, p) => setTempListAction(a, p, selected),
                'Config saved',
                () => queryClient.invalidateQueries({ queryKey: toolLoaningKeys.toolWallet(account) })
              )
            }
          >
            Save Config
          </Button>
        </div>
      </div>

      <div className="config-list">
        {toolOv.isLoading
          ? Array.from({ length: 6 }, (_, i) => <div key={i} className="skeleton config-row__loading" />)
          : sorted.map((tool) => {
              const on = selected.includes(tool.template_id)
              return (
                <label key={tool.template_id} className={`config-row ${on ? 'is-on' : ''}`}>
                  <span className="config-row__thumb" style={{ borderColor: RARITY_COLORS[tool.rarity] }}>
                    <img src={publicUrl(`/assets/aw-nft-images/${tool.template_id}.webp`)} alt="" loading="lazy" />
                  </span>
                  <span className="config-row__name">
                    <strong>
                      {tool.tool_name}
                      {tool.owned > 0 && <span className="muted num"> ({tool.owned})</span>}
                    </strong>
                    <span className="tl-card__sub">{tool.shine}</span>
                  </span>
                  <span className="config-row__stats">
                    <span className="chip" title="Mining power">
                      <PickaxeSVG /> {tool.mining_power / 10}
                    </span>
                    <span className="chip" title="NFT power">
                      <ShardsSVG /> {tool.nft_power / 10}
                    </span>
                    <span className="chip" title="Cooldown on Geothermal Springs">
                      <ClockIcon /> {Math.round(loanCooldownSeconds(tool) / 60)}m
                    </span>
                  </span>
                  <span className="toggle">
                    <input type="checkbox" checked={on} onChange={(e) => toggle(tool.template_id, e.target.checked)} />
                    <span className="toggle__track" aria-hidden>
                      <span className="toggle__thumb" />
                    </span>
                  </span>
                </label>
              )
            })}
      </div>
    </section>
  )
}
