import type { ReactNode } from 'react'

import { DISCORD_URL } from '@/chain/config'
import { usePlayer } from '@/data/queries'
import ApplicationsSVG from '@/icons/applications'
import AwMiningSVG from '@/icons/aw-mining'
import BulldozerSVG from '@/icons/bulldozer'
import CalculationSVG from '@/icons/calculation'
import DiscordSVG from '@/icons/discord'
import Exclamation2SVG from '@/icons/exclamation2'
import GiftSVG from '@/icons/gift'
import LaserGunSVG from '@/icons/laserGun'
import MCPBuilderSVG from '@/icons/mcp-builder'
import MembershipSVG from '@/icons/membership'
import NewsSVG from '@/icons/news'
import PickaxeSVG from '@/icons/pickaxe'
import RocketSVG from '@/icons/rocket'
import TriliumVaultSVG from '@/icons/trilium-vault'
import TreasureSVG from '@/icons/treasure'
import TrophySVG from '@/icons/trophy'
import VotingSVG from '@/icons/voting'

export type NavGroup = 'main' | 'tools' | 'more'

export interface NavItem {
  path: string
  title: string
  icon: ReactNode
  disabled?: boolean
  external?: boolean
  /** Shown in the mobile tab bar; everything else lives in the More sheet. */
  primary?: boolean
}

/** Tab bar order on phones, most-used first. */
export const TABBAR_ORDER = ['builder', 'adventures', 'tool-loaning', 'emporium']

/**
 * Every section of the app. Items members can't use yet stay visible but disabled.
 *  main  — opened most days, always on the bar
 *  tools — opened now and then, behind More
 *  more  — opened rarely, behind More
 */
export function useNavItems(): Record<NavGroup, NavItem[]> {
  const { isMember, isFullMember, isSupport } = usePlayer()

  return {
    main: [
      { path: 'builder', title: 'Builder', primary: true, disabled: !isFullMember, icon: <MCPBuilderSVG /> },
      {
        path: 'adventures',
        title: 'Adventures',
        primary: true,
        disabled: !isFullMember,
        icon: <RocketSVG color1="#00A3FF" color2="#E75300" />
      },
      { path: 'questing', title: 'Weekly Quests', disabled: !isFullMember, icon: <Exclamation2SVG color="#ff4f6b" /> },
      { path: 'daily-rewards', title: 'Daily Claim', disabled: !isMember, icon: <GiftSVG /> },
      { path: 'tool-loaning', title: 'Tool Loaning', primary: true, disabled: !isMember, icon: <PickaxeSVG version={1} /> },
      { path: 'aw-mining', title: 'Mining', icon: <AwMiningSVG /> },
      { path: 'emporium', title: "Zapp's", primary: true, icon: <LaserGunSVG /> },
      { path: 'treasure-hunt', title: 'Treasure Hunt', icon: <TreasureSVG /> },
      // Support only ever reaches the site for this one, so it stays on the bar for them.
      ...(isSupport ? [{ path: 'applications', title: 'Applications', icon: <ApplicationsSVG /> }] : [])
    ],
    tools: [
      { path: 'week-reward', title: 'Rewards', disabled: !isFullMember, icon: <TrophySVG color1="#AC12AF" color2="#AC12AF" /> },
      { path: 'mine-max', title: 'Mine Maximizer', icon: <BulldozerSVG color1="#00ADD3" color2="#00ADD3" /> },
      { path: 'voting', title: 'Voting', disabled: !isFullMember, icon: <VotingSVG color="#46C553" /> },
      { path: 'trilium-vault', title: 'Vault', icon: <TriliumVaultSVG color="#26d7ff" /> },
      { path: 'tool-tactician', title: 'Tool Tactician', icon: <CalculationSVG color="#FFC700" /> }
    ],
    more: [
      { path: 'membership', title: 'Membership', icon: <MembershipSVG color="#57CE4C" /> },
      { path: 'news', title: 'News', icon: <NewsSVG color="#D32C54" /> },
      { path: DISCORD_URL, title: 'Discord', external: true, icon: <DiscordSVG color="#9563FF" /> }
    ]
  }
}

export const NAV_GROUPS: NavGroup[] = ['main', 'tools', 'more']

/** The groups that sit behind the desktop bar's More button. */
export const SECONDARY_GROUPS: NavGroup[] = ['tools', 'more']
