import { Option } from 'effect'
import { describe, expect, test } from 'vitest'

import { additionTo } from './copyPlan'

const placed = (main: number, sideboard: number, champion = 0) => ({
  main,
  sideboard,
  champion,
  other: 0,
})
const three = Option.some(3)

describe('adding a copy', () => {
  test('under the limit a copy is added where asked', () => {
    expect(additionTo('Main', placed(1, 1), three, 10)).toStrictEqual(
      Option.some('Add'),
    )
    expect(additionTo('Sideboard', placed(1, 1), three, 10)).toStrictEqual(
      Option.some('Add'),
    )
  })

  test('at the limit a copy moves over from the other part', () => {
    expect(additionTo('Sideboard', placed(3, 0), three, 10)).toStrictEqual(
      Option.some('MoveFromMain'),
    )
    expect(additionTo('Main', placed(2, 1), three, 10)).toStrictEqual(
      Option.some('MoveFromSideboard'),
    )
  })

  test('the chosen champion counts towards the limit', () => {
    expect(additionTo('Main', placed(2, 0, 1), three, 10)).toStrictEqual(
      Option.none(),
    )
  })

  test('a full part takes nothing more, not even a moved copy', () => {
    expect(additionTo('Main', placed(1, 1), three, 0)).toStrictEqual(
      Option.none(),
    )
    expect(additionTo('Main', placed(2, 1), three, 0)).toStrictEqual(
      Option.none(),
    )
  })

  test('nothing can be added at the limit with nothing to move, or with a full sideboard', () => {
    expect(additionTo('Main', placed(3, 0), three, 10)).toStrictEqual(
      Option.none(),
    )
    expect(additionTo('Sideboard', placed(1, 0), three, 0)).toStrictEqual(
      Option.none(),
    )
  })

  test('a card without a limit can always be added', () => {
    expect(additionTo('Main', placed(9, 0), Option.none(), 10)).toStrictEqual(
      Option.some('Add'),
    )
  })

  test('runes and battlefields count only their own zone', () => {
    expect(
      additionTo(
        'Other',
        { main: 0, sideboard: 0, champion: 0, other: 1 },
        Option.some(1),
        10,
      ),
    ).toStrictEqual(Option.none())
  })
})
