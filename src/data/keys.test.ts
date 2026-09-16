import { partialMatchKey } from '@tanstack/query-core'
import { describe, expect, it } from 'vitest'

import { adventureKeys, builderKeys, miningKeys, playerKeys, vaultKeys, votingKeys } from './keys'

// The refresh helpers invalidate by prefix; these pairs must keep matching.
describe('invalidation prefixes cover the full keys', () => {
  it.each([
    ['favorites of an account', miningKeys.favorites('a.wam', '1,2', 'x|y'), miningKeys.favorites('a.wam')],
    ['adventure inventories', adventureKeys.inventory('a.wam', 'crew.worlds'), adventureKeys.inventoryAll],
    ['adventure participations', adventureKeys.participants('a.wam'), adventureKeys.participantsAll],
    ['joined adventures', adventureKeys.joined(10, 20), adventureKeys.joinedAll],
    ['builder player', builderKeys.player('a.wam'), builderKeys.playerAll],
    ['builder inventories', builderKeys.inventory('a.wam', 'tool.worlds'), builderKeys.inventoryAll],
    ['vault queries', vaultKeys.payouts('a.wam'), vaultKeys.all],
    ['voting queries', votingKeys.dao('eyeke'), votingKeys.all]
  ])('%s', (_, full, prefix) => {
    expect(partialMatchKey([...full], [...prefix])).toBe(true)
  })

  it('does not cross accounts', () => {
    expect(partialMatchKey([...miningKeys.favorites('a.wam', '1', 'x')], [...miningKeys.favorites('b.wam')])).toBe(false)
    expect(partialMatchKey([...playerKeys.member('a.wam')], [...playerKeys.member('b.wam')])).toBe(false)
  })
})
