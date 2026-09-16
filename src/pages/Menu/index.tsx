import { AlienLegends } from './AlienLegends'
import { DidYouKnow } from './DidYouKnow'
import { News } from './News'
import { NextUp } from './NextUp'
import { WeeklyStatistics } from './WeeklyStatistics'

import './Menu.css'

/** Home dashboard: the week's numbers, then what the player can act on. */
export default function Menu() {
  return (
    <div className="page menu">
      <WeeklyStatistics />
      <NextUp />
      <AlienLegends />
      <DidYouKnow />
      <News />
    </div>
  )
}
