import { useState, type ReactNode } from 'react'

import { AW_IMAGE_URL } from '@/chain/config'
import { LockIcon } from '@/components/icons'
import { adventureImageSlug, formatAffixValue, type ModUnlocks } from '@/data/adventures'
import type { Adventure, AdventureMod, AdvTemplate } from '@/data/types'
import Filter2SVG from '@/icons/filter2'
import type { TimeLeft } from '@/lib/time'
import { publicUrl } from '@/lib/publicUrl'

export const countdown = (t: TimeLeft) => `${t.days}d ${t.hours}h ${t.minutes}min`

/** Tries each source in turn when one fails to load. */
function FallbackImg({ sources, alt = '', className }: { sources: string[]; alt?: string; className?: string }) {
  const [index, setIndex] = useState(0)
  return (
    <img
      className={className}
      src={sources[Math.min(index, sources.length - 1)]}
      alt={alt}
      loading="lazy"
      onError={() => setIndex((i) => (i < sources.length - 1 ? i + 1 : i))}
    />
  )
}

/** Adventure artwork: local copy first (scripts/fetch-adventure-images.mjs), then public gateways. */
export function AdventureImg({ image, className }: { image: string; className?: string }) {
  const clean = image.trim()
  return (
    <FallbackImg
      key={clean}
      className={className}
      sources={[
        publicUrl(`/assets/adventures/${adventureImageSlug(clean)}.webp`),
        `https://gateway.pinata.cloud/ipfs/${clean}`,
        `https://ipfs.filebase.io/ipfs/${clean}`,
        // Some old artwork is no longer pinned anywhere; show the Adventures banner rather than a broken image.
        publicUrl('/assets/background/bg-adventures.jpeg')
      ]}
    />
  )
}

/** NFT card art: local copy first, then the Alien Worlds gateway, then a card back. */
interface CardImgProps {
  templateId?: number
  template?: AdvTemplate
  /** IPFS hash from the asset itself: new cards may have neither a local image nor an adventure template. */
  image?: string
  alt?: string
}

/** Card art: local copy (scripts/fetch-card-images.mjs), then IPFS, then the card back. */
export function CardImg({ templateId, template, image, alt }: CardImgProps) {
  const hashes = [...new Set([template?.nftimage, image].filter((hash): hash is string => !!hash))]
  const sources = templateId
    ? [
        publicUrl(`/assets/aw-nft-images/${templateId}.webp`),
        ...hashes.map((hash) => `${AW_IMAGE_URL}/ipfs/${hash}`),
        publicUrl('/assets/default-card.png')
      ]
    : [publicUrl('/assets/default-card.png')]
  return <FallbackImg key={templateId ?? 0} sources={sources} alt={alt ?? template?.cardname ?? ''} />
}

export function SponsorRibbon({ adventure }: { adventure: Adventure }) {
  if (!adventure.sponsored) return null
  return (
    <div className="adv-ribbon">
      <span>Sponsor</span>
      <small>{adventure.sponsor}</small>
    </div>
  )
}

interface ModRowProps {
  mod: AdventureMod
  align: 'left' | 'right'
  locked: boolean
  unlockLevel: number
  matched?: boolean
  filterActive?: boolean
  onFilter?: () => void
}

export function ModRow({ mod, align, locked, unlockLevel, matched, filterActive, onFilter }: ModRowProps) {
  return (
    <div className={`adv-mod adv-mod--${align} ${locked ? 'is-locked' : ''} ${matched ? 'is-matched' : ''}`}>
      {locked ? (
        <>
          <LockIcon />
          <span className="adv-mod__lock">unlocked at level {unlockLevel}</span>
        </>
      ) : (
        <>
          <span className="adv-mod__type">
            <span className="adv-mod__affix">{mod.affix_type}</span>
            <span className="adv-mod__value" title={formatAffixValue(mod)}>
              {formatAffixValue(mod)}
            </span>
          </span>
          <span className="adv-mod__pct num">+{mod.mod_value}%</span>
          {onFilter && (
            <button className={`adv-mod__filter ${filterActive ? 'is-active' : ''}`} onClick={onFilter} aria-pressed={!!filterActive} aria-label="Filter">
              <Filter2SVG />
            </button>
          )}
        </>
      )}
    </div>
  )
}

/** Modifiers in two columns of five, as on the original adventure cards. */
export function ModGrid({ mods, unlocks }: { mods: AdventureMod[]; unlocks: ModUnlocks }) {
  return (
    <div className="adv-mods">
      {mods.map((mod, i) => (
        <ModRow
          key={i}
          mod={mod}
          align={i < 5 ? 'left' : 'right'}
          locked={!unlocks.isUnlocked(i)}
          unlockLevel={unlocks.levelFor(i)}
        />
      ))}
    </div>
  )
}

/** One readout on a card: a quiet label over the figure. */
export function Stat({ label, value, icon }: { label: string; value: string | number; icon?: ReactNode }) {
  return (
    <span className="adv-stat">
      <span className="adv-stat__label">{label}</span>
      <span className="adv-stat__value num">
        {value}
        {icon}
      </span>
    </span>
  )
}
