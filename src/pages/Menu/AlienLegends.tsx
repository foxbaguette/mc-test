import { useAlePlayer } from '@/data/queries'
import { useAccount } from '@/state/session'
import { publicUrl } from '@/lib/publicUrl'

const ALIEN_LEGENDS_URL = 'https://alienlegends.io'

/** Wallets that always see the banner, signed up or not. */
const ALWAYS_SHOWN = ['5thba.wam']

/** Shown to players who have never signed up in Alien Legends. */
export function AlienLegends() {
  const account = useAccount()
  const player = useAlePlayer(account)

  const forced = !!account && ALWAYS_SHOWN.includes(account)
  if (!forced && (!player.isFetched || player.data)) return null

  return (
    <a className="ale-banner" href={ALIEN_LEGENDS_URL} target="_blank" rel="noreferrer">
      <img className="ale-banner__logo" src={publicUrl('/assets/icons/alien-legends.png')} alt="Alien Legends" />
      <span className="ale-banner__text">
        <strong>You have not started Alien Legends yet.</strong>
        <span>Fight, quest and earn in the Alien Worlds metaverse — and pick up Weekly Quests here along the way.</span>
      </span>
      <span className="ale-banner__cta">Play now</span>
    </a>
  )
}
