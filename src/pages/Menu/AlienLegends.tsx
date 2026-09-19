import { publicUrl } from '@/lib/publicUrl'

const ALIEN_LEGENDS_URL = 'https://alienlegends.io'

export function AlienLegends() {
  return (
    <a className="ale-banner" href={ALIEN_LEGENDS_URL} target="_blank" rel="noreferrer">
      <img className="ale-banner__logo" src={publicUrl('/assets/icons/alien-legends.png')} alt="Alien Legends" />
      <span className="ale-banner__text">
        <strong>Have you already tried Alien Legends?</strong>
        <span>Fight, quest and earn in the Alien Worlds metaverse — and pick up Weekly Quests here along the way.</span>
      </span>
      <span className="ale-banner__cta">Play now</span>
    </a>
  )
}
