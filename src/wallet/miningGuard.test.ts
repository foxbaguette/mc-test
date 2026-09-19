import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useToasts } from '@/components/toast'
import type { LoanTool } from '@/data/toolLoaning'
import { castVoteActions } from '@/chain/actions/voting'
import { claimMinesAction, mineActions, setLandAction } from '@/chain/actions/mining'
import { loanMineActions } from '@/chain/actions/toolLoaning'
import { mineWithLoanedTool } from '@/mining/loan'
import { mineNow } from '@/mining/mineNow'
import { useSession } from '@/state/session'

import { canMine, MINING_BLOCKED_MESSAGE, minesWithBlockedWallet } from './session'

// Anchor may sign in, but no mine may ever be sent from it: not from the top bar, Tool Loaning or the Mine Maximizer.

const account = 'test1.wam'
const mine = mineActions(account, 'active', '00ff00ff00ff00ff')
const mineOnLand = mineActions(account, 'active', '00ff00ff00ff00ff', '1099512958237')
const loanMine = loanMineActions(account, 'active', {
  assetIds: ['1099'],
  landId: '1099512958237',
  nonce: '00ff00ff00ff00ff',
  restoreBag: ['1']
})

describe('canMine', () => {
  it('blocks Anchor only', () => {
    expect(canMine('anchor')).toBe(false)
    expect(canMine('cloudwallet')).toBe(true)
    expect(canMine('wombat')).toBe(true)
  })

  it('does not block before a wallet is known', () => {
    expect(canMine(null)).toBe(true)
  })
})

describe('minesWithBlockedWallet (the check right before signing)', () => {
  it('stops every kind of mine from Anchor', () => {
    expect(minesWithBlockedWallet('anchor', mine)).toBe(true)
    expect(minesWithBlockedWallet('anchor', mineOnLand)).toBe(true)
    expect(minesWithBlockedWallet('anchor', loanMine)).toBe(true)
  })

  it('lets Anchor sign everything that is not a mine', () => {
    expect(minesWithBlockedWallet('anchor', [setLandAction(account, 'active', '1099512958237')])).toBe(false)
    expect(minesWithBlockedWallet('anchor', [claimMinesAction(account, 'active')])).toBe(false)
    expect(minesWithBlockedWallet('anchor', castVoteActions(account, 'active', 'eyeke', ['cand1.wam'], 10))).toBe(false)
  })

  it('lets Cloud Wallet and Wombat mine', () => {
    expect(minesWithBlockedWallet('cloudwallet', mine)).toBe(false)
    expect(minesWithBlockedWallet('wombat', loanMine)).toBe(false)
  })
})

describe('mine flows with Anchor signed in', () => {
  const fetchMock = vi.fn(() => Promise.reject(new Error('offline')))
  const workerMock = vi.fn()
  const lastToast = () => useToasts.getState().toasts.at(-1)?.message

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock)
    vi.stubGlobal('Worker', workerMock)
    useSession.setState({ account, wallet: 'anchor' })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    fetchMock.mockClear()
    workerMock.mockClear()
    useToasts.setState({ toasts: [] })
  })

  it('stops the normal mine before reading the chain or computing the proof of work', async () => {
    expect(await mineNow({ account, permission: 'active', tools: [] })).toBe(false)
    expect(lastToast()).toBe(MINING_BLOCKED_MESSAGE)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(workerMock).not.toHaveBeenCalled()
  })

  it('stops the Mine Maximizer and favorites, which mine on another land', async () => {
    expect(await mineNow({ account, permission: 'active', tools: [], landId: '1099512958237' })).toBe(false)
    expect(lastToast()).toBe(MINING_BLOCKED_MESSAGE)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('stops Tool Loaning before a tool is rented', async () => {
    const tool = { tool_name: 'Standard Drill', template_id: 19552, pow: 1 } as unknown as LoanTool
    expect(await mineWithLoanedTool({ account, permission: 'active', tool, bagIds: [], landId: '1099512958237' })).toBe(false)
    expect(lastToast()).toBe(MINING_BLOCKED_MESSAGE)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('does not stop Cloud Wallet: the mine goes on to read the chain', async () => {
    useSession.setState({ wallet: 'cloudwallet' })
    expect(await mineNow({ account, permission: 'active', tools: [] })).toBe(false)
    expect(fetchMock).toHaveBeenCalled()
    expect(lastToast()).not.toBe(MINING_BLOCKED_MESSAGE)
  })
})
