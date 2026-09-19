import { CONTRACTS, PLANET_SCOPES, type Planet } from '@/chain/config'
import { getRow, getRows } from '@/chain/rpc'
import type { AwTool, Bag, LandType, Miner, MinerClaim, MineTrack, PlanetPools, SuggestedLand, ToolUse } from './types/mining'
import type {
  Blog,
  ClaimChance,
  CollectInfo,
  KeyValue,
  Level,
  McSettings,
  MissionSettings,
  Quest,
  Tip,
  Treasure,
  Week
} from './types/game'
import type { FlagReason, Member, UserPoints, UserWeekly } from './types/player'
import type { MTool, StakedTool, ToolOv, ToolWallet } from './types/toolLoaning'
import type {
  BuilderBonus,
  BuilderPlayer,
  BuilderRanking,
  BuilderSeason,
  BuilderSettings,
  BuilderSwapPool,
  BuildingDef
} from './types/builder'
import type { Adventure, AdventureParticipation, AdvTemplate, LevelUnlock } from './types/adventures'
import type { EmporiumConfig, EmporiumTask } from './types/emporium'
import type { DaoCandidate, PlanetCandidate, VoteHistory, VotingConfig } from './types/voting'

const { MISSIONS, MEMBERS, USPTS, ALIEN_WORLDS, HQ_MU, M_FEDERATION, AWLNDRATINGS, PLANETAWORLD } = CONTRACTS

const exact = (account: string) => ({ lower_bound: account, upper_bound: account })

// missions.mc
export const readWeeks = () => getRows<Week>({ code: MISSIONS, table: 'weeks', reverse: true })
export const readMissionSettings = () => getRow<MissionSettings>({ code: MISSIONS, table: 'settings' })
export const readQuests = () => getRows<Quest>({ code: MISSIONS, table: 'quests' })
export const readCollectInfo = () => getRows<CollectInfo>({ code: MISSIONS, table: 'collectinfo' })
export const readBlogs = () => getRows<Blog>({ code: MISSIONS, table: 'blogs' })
export const readSuggestedLands = () => getRows<SuggestedLand>({ code: MISSIONS, table: 'lands' })
export const readUserWeeklies = (account: string) =>
  getRows<UserWeekly>(
    { code: MISSIONS, table: 'userweekly', index_position: 4, key_type: 'name', reverse: true, ...exact(account) },
    { confirmEmpty: true }
  )

// members.mc
export const readMember = (account: string) =>
  getRow<Member>({ code: MEMBERS, table: 'mcmembers', ...exact(account) }, { confirmEmpty: true })
export const readAllMembers = () => getRows<Member>({ code: MEMBERS, table: 'mcmembers' })
export const readLevels = () => getRows<Level>({ code: MEMBERS, table: 'levels' })
export const readMcSettings = () => getRow<McSettings>({ code: MEMBERS, table: 'settings' })
export const readClaimChances = () => getRows<ClaimChance>({ code: MEMBERS, table: 'claimchance' })
export const readTips = () => getRows<Tip>({ code: MEMBERS, table: 'tips' })
export const readFlagReasons = () => getRows<FlagReason>({ code: MEMBERS, table: 'reasons' })
export const readPlayerSupport = (account: string) =>
  getRow<{ wallet: string }>({ code: MEMBERS, table: 'support', ...exact(account) })
export const readSupportLog = (account: string) =>
  getRows<{ supporter: string; member: string; action: string; timestamp: string }>({
    code: MEMBERS,
    table: 'suplog',
    index_position: 2,
    key_type: 'name',
    reverse: true,
    ...exact(account)
  })

// voting.mc / dao.worlds
const { VOTING, DAO_WORLDS } = CONTRACTS
export const readVotingConfig = () => getRow<VotingConfig>({ code: VOTING, table: 'config' })
export const readPlanetCandidates = (planet: string) =>
  getRows<PlanetCandidate>({
    code: VOTING,
    table: 'candidates',
    index_position: 3,
    key_type: 'name',
    lower_bound: planet,
    upper_bound: planet
  })
/** The table has no index on voter, but it only holds about a month of votes: read it whole. */
export const readVoteHistory = () => getRows<VoteHistory>({ code: VOTING, table: 'history' })
export const readVoteBlocklist = () => getRows<{ wallet: string }>({ code: VOTING, table: 'blocklist' })
export const readDaoCandidates = (planet: string) =>
  getRows<DaoCandidate>({ code: DAO_WORLDS, table: 'candidates', scope: planet })

// uspts.worlds / alien.worlds
export const readUserPoints = (account: string) =>
  getRow<UserPoints>({ code: USPTS, table: 'userpoints', ...exact(account) }, { confirmEmpty: true })
export async function readTlmBalance(account: string): Promise<number> {
  const row = await getRow<{ balance: string }>({ code: ALIEN_WORLDS, table: 'accounts', scope: account })
  return Number(String(row?.balance ?? '0').replace(' TLM', '')) || 0
}

// hq.mu
export const readAwTools = () => getRows<AwTool>({ code: HQ_MU, table: 'awtools' })
export const readLandTypes = () => getRows<LandType>({ code: HQ_MU, table: 'awlandtypes' })
export const readMineTrack = () => getRow<MineTrack>({ code: HQ_MU, table: 'mineptrack' })

// m.federation
export const readMiner = (account: string) =>
  getRow<Miner>({ code: M_FEDERATION, table: 'miners', ...exact(account) }, { confirmEmpty: true })
export const readBag = (account: string) =>
  getRow<Bag>({ code: M_FEDERATION, table: 'bags', ...exact(account) }, { confirmEmpty: true })
export const readToolUse = (assetId: string) => getRow<ToolUse>({ code: M_FEDERATION, table: 'tooluse', ...exact(assetId) })
export const readLandComms = (account: string) =>
  getRow<{ landowner: string; comms: string }>({ code: M_FEDERATION, table: 'landcomms', ...exact(account) })
export const readPlanetPools = (planet: Planet) =>
  getRow<PlanetPools>({ code: M_FEDERATION, table: 'pools', scope: PLANET_SCOPES[planet] })

// awlndratings / planetaworld
export async function readPlanetConfig(planet: Planet): Promise<KeyValue<[string, number]>[]> {
  const row = await getRow<{ data: KeyValue<[string, number]>[] }>({
    code: AWLNDRATINGS,
    table: 'plntconfigs',
    scope: PLANET_SCOPES[planet]
  })
  return row?.data ?? []
}
export const readLandPayouts = (account: string) =>
  getRow<{ receiver: string; payoutAmount: string }>({ code: AWLNDRATINGS, table: 'payouts', ...exact(account) })
export const readTreasures = () => getRows<Treasure>({ code: PLANETAWORLD, table: 'treasures' })

export const readTreasureWinners = (treasureName: string) =>
  getRow<{ treasure_name: string; winners: string[] }>({ code: PLANETAWORLD, table: 'winners', ...exact(treasureName) })

// tools.mc (Tool Loaning)
const { TOOLS } = CONTRACTS
export const readToolOv = () => getRows<ToolOv>({ code: TOOLS, table: 'toolov' })
export const readToolOvRow = (templateId: number) =>
  getRow<ToolOv>({ code: TOOLS, table: 'toolov', lower_bound: templateId, upper_bound: templateId })
export const readToolWallet = (account: string) =>
  getRow<ToolWallet>({ code: TOOLS, table: 'wallets', ...exact(account) }, { confirmEmpty: true })
export const readStakedTools = (account: string) =>
  getRows<StakedTool>(
    { code: TOOLS, table: 'tools', index_position: 3, key_type: 'name', ...exact(account) },
    { confirmEmpty: true }
  )
export const readMTools = () => getRows<MTool>({ code: TOOLS, table: 'mtools' })
// emporium.mc (Zapp's)
const { EMPORIUM } = CONTRACTS
export const readEmporiumConfig = () => getRow<EmporiumConfig>({ code: EMPORIUM, table: 'config' })
export const readActiveTasks = () =>
  getRows<EmporiumTask>(
    { code: EMPORIUM, table: 'tasks', index_position: 2, key_type: 'name', lower_bound: 'active', upper_bound: 'active' },
    { confirmEmpty: true }
  )
export const readCompletedTasks = () =>
  getRows<EmporiumTask>({
    code: EMPORIUM,
    table: 'tasks',
    index_position: 2,
    key_type: 'name',
    lower_bound: 'completed',
    upper_bound: 'completed',
    limit: 30,
    reverse: true
  })

// adventure.mc
const { ADVENTURE } = CONTRACTS
/** Adventures still open to join, via the enter_end index. */
export const readOpenAdventures = () =>
  getRows<Adventure>(
    { code: ADVENTURE, table: 'adventures', index_position: 2, key_type: 'i64', lower_bound: Math.floor(Date.now() / 1000) },
    { confirmEmpty: true }
  )
export const readAdventureRange = (from: number, to: number) =>
  getRows<Adventure>({ code: ADVENTURE, table: 'adventures', lower_bound: from, upper_bound: to })
export const readParticipations = (account: string) =>
  getRows<AdventureParticipation>(
    { code: ADVENTURE, table: 'participants', index_position: 3, key_type: 'name', ...exact(account) },
    { confirmEmpty: true }
  )
export const readAdventureSettings = () => getRow<{ auto_create_hours: number }>({ code: ADVENTURE, table: 'settings' })
export const readAdvTemplates = () => getRows<AdvTemplate>({ code: ADVENTURE, table: 'advtemplates' })
export const readLevelUnlocks = () => getRows<LevelUnlock>({ code: ADVENTURE, table: 'levelunlocks' })

// game.mc (Outpost Builder)
const { GAME } = CONTRACTS
export const readBuilderSeason = () => getRow<BuilderSeason>({ code: GAME, table: 'season' })
export const readBuilderSettings = () => getRow<BuilderSettings>({ code: GAME, table: 'settings' })
export const readSwapPool = () => getRow<BuilderSwapPool>({ code: GAME, table: 'swappool' })
export const readBuildingDefs = () => getRows<BuildingDef>({ code: GAME, table: 'buildings' })
export const readBuilderBonuses = () => getRows<BuilderBonus>({ code: GAME, table: 'bonuses' })
export const readBuilderPlayer = (account: string) =>
  getRow<BuilderPlayer>({ code: GAME, table: 'players', ...exact(account) }, { confirmEmpty: true })
/** Top 100 by a secondary index: 2 = MCP earned, 3 = building score, 4 = Я per minute. */
export const readBuilderLeaderboard = (index: number) =>
  getRows<BuilderPlayer>({ code: GAME, table: 'players', index_position: index, key_type: 'i64', limit: 100, reverse: true })
export const readBuilderRanking = () => getRows<BuilderRanking>({ code: GAME, table: 'ranking' })

export const readMinerClaim = (account: string) =>
  getRow<MinerClaim>({ code: M_FEDERATION, table: 'minerclaim', ...exact(account) })
