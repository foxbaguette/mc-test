import type { ReactNode } from 'react'

import { DISCORD_URL } from '@/chain/config'
import { useMembership, usePlayerSupport } from '@/data/player'
import { usePdMember } from '@/data/planetaryDefense'
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
import PlanetaryDefenseSVG from '@/icons/planetary-defense'
import RocketSVG from '@/icons/rocket'
import TriliumVaultSVG from '@/icons/trilium-vault'
import TreasureSVG from '@/icons/treasure'
import TrophySVG from '@/icons/trophy'
import VotingSVG from '@/icons/voting'

import { NavIcon } from './NavIcon'

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

/** Tool Loaning's gold, shared by the glyph and its emblem. */
const TOOL_GOLD = '#ebb309'

/** Tab bar order on phones, most-used first. */
export const TABBAR_ORDER = ['builder', 'adventures', 'tool-loaning', 'emporium']

/**
 * Every section of the app. Items members can't use yet stay visible but disabled.
 *  main  — opened most days, always on the bar
 *  tools — opened now and then, behind More
 *  more  — opened rarely, behind More
 */
export function useNavItems(): Record<NavGroup, NavItem[]> {
  const { account, isMember, isFullMember } = useMembership()
  const isSupport = !!usePlayerSupport(account).data?.wallet
  // Planetary Defense is for players with an account there (members) and its warlords.
  const isPdMember = !!usePdMember(account).data

  return {
    main: [
      {
        path: 'builder',
        title: 'Builder',
        primary: true,
        disabled: !isFullMember,
        icon: (
          <NavIcon color="#9fb6cf" glyph="#eef2f7">
            <MCPBuilderSVG />
          </NavIcon>
        )
      },
      {
        path: 'adventures',
        title: 'Adventures',
        primary: true,
        disabled: !isFullMember,
        icon: (
          <NavIcon color="#3ab0ff" multicolor>
            <RocketSVG color1="#00A3FF" color2="#E75300" />
          </NavIcon>
        )
      },
      {
        path: 'questing',
        title: 'Weekly Quests',
        disabled: !isFullMember,
        icon: (
          <NavIcon color="#ff5a76">
            <Exclamation2SVG color="#ff4f6b" />
          </NavIcon>
        )
      },
      {
        path: 'daily-rewards',
        title: 'Daily Claim',
        disabled: !isMember,
        icon: (
          <NavIcon color="#8fd14f">
            <GiftSVG />
          </NavIcon>
        )
      },
      {
        path: 'tool-loaning',
        title: 'Tool Loaning',
        primary: true,
        disabled: !isMember,
        icon: (
          <NavIcon color={TOOL_GOLD}>
            <PickaxeSVG version={1} color={TOOL_GOLD} />
          </NavIcon>
        )
      },
      {
        path: 'aw-mining',
        title: 'Mining',
        icon: (
          <NavIcon color="#ffcf40">
            <AwMiningSVG />
          </NavIcon>
        )
      },
      {
        path: 'emporium',
        title: "Zapp's",
        primary: true,
        icon: (
          <NavIcon color="#3cf08a" multicolor>
            <LaserGunSVG />
          </NavIcon>
        )
      },
      {
        path: 'treasure-hunt',
        title: 'Treasure Hunt',
        icon: (
          <NavIcon color="#d7c28c" glyph="#ffffff">
            <TreasureSVG />
          </NavIcon>
        )
      },
      ...(isPdMember
        ? [
            {
              path: 'planetary-defense',
              title: 'Planetary Defense',
              icon: (
                <NavIcon color="#2de2ff">
                  <PlanetaryDefenseSVG color="#2de2ff" />
                </NavIcon>
              )
            }
          ]
        : []),
      // Support only ever reaches the site for this one, so it stays on the bar for them.
      ...(isSupport
        ? [
            {
              path: 'applications',
              title: 'Applications',
              icon: (
                <NavIcon color="#3f72e8" multicolor>
                  <ApplicationsSVG />
                </NavIcon>
              )
            }
          ]
        : [])
    ],
    tools: [
      {
        path: 'week-reward',
        title: 'Rewards',
        disabled: !isFullMember,
        icon: (
          <NavIcon color="#c24dff">
            <TrophySVG color1="#AC12AF" color2="#AC12AF" />
          </NavIcon>
        )
      },
      {
        path: 'mine-max',
        title: 'Mine Maximizer',
        icon: (
          <NavIcon color="#27c6ec">
            <BulldozerSVG color1="#00ADD3" color2="#00ADD3" />
          </NavIcon>
        )
      },
      {
        path: 'voting',
        title: 'Voting',
        disabled: !isFullMember,
        icon: (
          <NavIcon color="#44d470">
            <VotingSVG color="#46C553" />
          </NavIcon>
        )
      },
      {
        path: 'trilium-vault',
        title: 'Vault',
        icon: (
          <NavIcon color="#3fdcff">
            <TriliumVaultSVG color="#26d7ff" />
          </NavIcon>
        )
      },
      {
        path: 'tool-tactician',
        title: 'Tool Tactician',
        icon: (
          <NavIcon color="#ffcc2e">
            <CalculationSVG color="#FFC700" />
          </NavIcon>
        )
      }
    ],
    more: [
      {
        path: 'membership',
        title: 'Membership',
        icon: (
          <NavIcon color="#56d96b">
            <MembershipSVG color="#57CE4C" />
          </NavIcon>
        )
      },
      {
        path: 'news',
        title: 'News',
        icon: (
          <NavIcon color="#ff4d6d">
            <NewsSVG color="#D32C54" />
          </NavIcon>
        )
      },
      {
        path: DISCORD_URL,
        title: 'Discord',
        external: true,
        icon: (
          <NavIcon color="#8f7bff">
            <DiscordSVG color="#9563FF" />
          </NavIcon>
        )
      }
    ]
  }
}

export const NAV_GROUPS: NavGroup[] = ['main', 'tools', 'more']

/** The groups that sit behind the desktop bar's More button. */
export const SECONDARY_GROUPS: NavGroup[] = ['tools', 'more']
