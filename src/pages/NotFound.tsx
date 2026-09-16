import { useNavigate } from 'react-router-dom'

import { DISCORD_URL } from '@/chain/config'
import { Button } from '@/components/Button'
import ArrowLeftSVG from '@/icons/arrow-left'
import DiscordSVG from '@/icons/discord'
import PlanetSVG from '@/icons/planet'

import './NotFound.css'

export default function NotFound() {
  const navigate = useNavigate()

  return (
    <div className="not-found">
      <div className="not-found__content">
        <p className="not-found__eyebrow">Ooops! · ERROR</p>

        <p className="not-found__404" aria-hidden>
          4
          <span className="not-found__planet">
            <PlanetSVG color="#F6A800" />
          </span>
          4
        </p>

        <h1 className="not-found__label">Page not found</h1>
        <p className="not-found__desc">
          There is an error on this page, it no longer exists or changed the name. Go back to the previous page or contact us on
          Discord.
        </p>

        <div className="not-found__actions">
          <Button color="ghost" pill onClick={() => navigate('/menu')}>
            <ArrowLeftSVG />
          </Button>
          <a href={DISCORD_URL} target="_blank" rel="noreferrer">
            <Button asSpan pill>
              DISCORD <DiscordSVG color="#fff" />
            </Button>
          </a>
        </div>
      </div>
    </div>
  )
}
