import { AlienLegends } from './AlienLegends'
import { DidYouKnow } from './DidYouKnow'
import { News } from './News'
import { NextUp } from './NextUp'
import { WeeklyStatistics } from './WeeklyStatistics'

import './Menu.css'

/** Home dashboard: what the player can act on first, then the week's numbers and the news. */
export default function Menu() {
  return (
    <div className="page menu">
      <NextUp />
      <AlienLegends />
      <DidYouKnow />
      <WeeklyStatistics />
      <News />
    </div>
  )
}
