import { useMemo, useState } from 'react'
import type { AnyAction } from '@wharfkit/session'

import { Button } from '@/components/Button'
import {
  buildingImage,
  currentResources,
  formatR,
  refreshBuilder,
  useBuilderBonuses,
  useBuildingDefs,
  useSchemaInventory
} from '@/data/builder'
import type { BuilderPlayer, PlayerBuilding } from '@/data/types/builder'
import { stakeBuildingNftsAction, upgradeBuildingAction } from '@/chain/actions/builder'
import { useTransaction } from '@/wallet/useTransaction'
import { useAccount } from '@/state/session'
import { publicUrl } from '@/lib/publicUrl'
import { useNow } from '@/lib/time'

import { Market } from './Market'
import { BuilderDialog, NftImg } from './shared'

interface DialogProps {
  player: BuilderPlayer
  building: PlayerBuilding
  onClose: () => void
}

/** A building opens over the outpost, so the player never leaves the overview. */
export function BuildingDialog({ player, building, onClose }: DialogProps) {
  return (
    <BuilderDialog className="bdlg" title={building.building_name} onClose={onClose}>
      {/* Keyed so a different building starts with a clean selection. */}
      <Detail key={building.buildingid} player={player} building={building} onClose={onClose} />
    </BuilderDialog>
  )
}

interface PickedCard {
  asset_id: string
  template_id: string
  bonus: number
}

const BONUS_LABEL: Record<string, string> = {
  market: 'ADDITIONAL BONUS DELIVERY',
  storage: 'BONUS STORAGE'
}

function Detail({ player, building }: DialogProps) {
  const now = useNow()
  const account = useAccount()
  const defs = useBuildingDefs()
  const bonuses = useBuilderBonuses()
  const { run, busy, pending } = useTransaction()
  const [schema, setSchema] = useState<string>()
  const [picked, setPicked] = useState<PickedCard[]>([])

  const def = defs.data?.find((d) => d.buildingid === building.buildingid)
  const resources = currentResources(player, now)
  const cost = building.gamecurrency_upgrade_cost
  const slots = def?.slot_unlock_levels ?? []
  const staked = building.staked_template_ids

  let unlocked = -1
  slots.forEach((level, i) => {
    if (building.building_level >= level) unlocked = i
  })
  const canStake = unlocked >= 0 && staked.length <= unlocked
  const openSlots = Math.max(0, unlocked + 1 - staked.length - picked.length)

  const activeSchema = schema ?? def?.allowed_schemas[0]
  const inventory = useSchemaInventory(canStake ? account : null, activeSchema)

  const groups = useMemo(
    () =>
      (inventory.data ?? [])
        .map((group) => ({
          ...group,
          bonus:
            bonuses.data?.find((b) => b.schema === activeSchema && b.rarity === group.rarity && b.shine === group.shine)
              ?.bonus_percent ?? 0
        }))
        .sort((a, b) => b.bonus - a.bonus || a.name.localeCompare(b.name)),
    [inventory.data, bonuses.data, activeSchema]
  )

  const bonus = building.nft_bonuspercent + picked.reduce((sum, card) => sum + card.bonus, 0)
  const isMarket = building.buildingid === 'market'

  const act = (key: string, build: (account: string, permission: string) => AnyAction, success: string) =>
    run(build, success, refreshBuilder, key)

  async function stake() {
    const ids = picked.map((card) => card.asset_id)
    if (await act('stake', (a, p) => stakeBuildingNftsAction(a, p, building.buildingid, ids), 'Stake successfully')) setPicked([])
  }

  const market = isMarket && <Market player={player} building={building} resources={resources} now={now} />

  const selection = canStake && def && (
    <section className="bdlg__panel">
      <h3 className="bdlg__title">NFT SELECTION</h3>
      <p className="builder-text">
        Each building allows different schemas for staking. The rarity of the NFT determines the efficiency bonus.
      </p>
      <div className="bschema">
        {def.allowed_schemas.map((name) => (
          <button
            key={name}
            className={`bschema__btn ${name === activeSchema ? 'is-active' : ''}`}
            onClick={() => setSchema(name)}
          >
            {name}
          </button>
        ))}
      </div>
      <div className="bnfts">
        {inventory.isLoading
          ? Array.from({ length: 12 }, (_, i) => <div key={i} className="skeleton bnft--skeleton" />)
          : groups.map((group) => {
              const free = group.assetIds.filter((id) => !picked.some((card) => card.asset_id === id))
              return (
                <button
                  key={group.template_id}
                  className="bnft"
                  title={group.name}
                  disabled={openSlots === 0 || free.length === 0}
                  onClick={() =>
                    setPicked((cards) => [...cards, { asset_id: free[0], template_id: group.template_id, bonus: group.bonus }])
                  }
                >
                  <NftImg templateId={group.template_id} alt={group.name} />
                  <span className="bnft__bonus num">{group.bonus}%</span>
                  {group.assetIds.length > 1 && <span className="bnft__count num">×{free.length}</span>}
                </button>
              )
            })}
      </div>
    </section>
  )

  const aside = (isMarket && !canStake && market) || selection

  return (
    <div className={`bdetail ${aside ? '' : 'bdetail--single'}`}>
      <div className="bdetail__col">
        <section className="bdlg__panel">
          <div className="bdetail__head">
            <span className="bdetail__level num">Level {building.building_level}</span>
            {building.building_type === 'production' && (
              <span className="bdetail__rate num">Я {formatR(building.gamecurrency_per_minute_boosted)}/min</span>
            )}
          </div>
          <p className="builder-text">{def?.building_description}</p>

          <div className="bdetail__upgrade">
            <div className="bdetail__cost">
              <span className="num">Я {formatR(cost)}</span>
              <Button
                className={!busy && resources >= cost ? 'btn--charged btn--soft' : ''}
                isLoading={pending === 'upgrade'}
                disabled={busy || resources < cost}
                onClick={() => act('upgrade', (a, p) => upgradeBuildingAction(a, p, building.buildingid), 'Upgrade successful')}
              >
                {building.building_level === 0 ? 'BUILD' : 'UPGRADE'}
              </Button>
            </div>
            <img className="bdetail__art" src={buildingImage(building.buildingid)} alt="" />
          </div>

          {slots.length > 0 && (
            <div className="bslots">
              {slots.map((level, i) => {
                const stakedTemplate = staked[i]
                const pick = i >= staked.length ? picked[i - staked.length] : undefined
                const state = stakedTemplate ? 'is-staked' : pick ? 'is-picked' : i <= unlocked ? 'is-open' : 'is-locked'
                return (
                  <button
                    key={i}
                    type="button"
                    className={`bslot ${state}`}
                    disabled={!pick || busy}
                    onClick={() => pick && setPicked((cards) => cards.filter((card) => card.asset_id !== pick.asset_id))}
                  >
                    <span className="bslot__level">Level {level}</span>
                    {stakedTemplate || pick ? (
                      <NftImg templateId={stakedTemplate ?? pick!.template_id} />
                    ) : (
                      <img src={publicUrl('/assets/default-card.png')} alt="" />
                    )}
                  </button>
                )
              })}
            </div>
          )}

          <p className="bdetail__bonus num">
            {bonus}% {BONUS_LABEL[building.buildingid] ?? 'BONUS PRODUCTION'}
          </p>

          <Button block isLoading={pending === 'stake'} disabled={busy || !canStake || picked.length === 0} onClick={stake}>
            STAKE UNTIL END OF SEASON
          </Button>
        </section>

        {isMarket && canStake && market}
      </div>

      {aside && <div className="bdetail__col">{aside}</div>}
    </div>
  )
}
