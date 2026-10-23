import { Option } from 'effect'
import { describe, expect, test } from 'vitest'

import { OwnedQuantity } from './collection'
import { Copies, type Deck, DeckId, DeckName, empty } from './deck'
import { copiesUsedBy, missingOnly, needs } from './missing'
import { PrintingId } from './printing'

const vi = PrintingId.make('ogn-066-298')
const viAlternate = PrintingId.make('ogn-066a-298')
const legend = PrintingId.make('ogn-261-298')

const deckWith = (id: string, contents: Deck['contents']): Deck => ({
  id: DeckId.make(id),
  name: DeckName.make('Deck'),
  contents,
})

const first = deckWith('7b0f2a7e-2a9c-4c6e-9d2b-6a6f1c9d2e11', {
  ...empty,
  maybeLegend: Option.some(legend),
  maybeChosenChampion: Option.some(vi),
  main: [{ printingId: vi, copies: Copies.make(2) }],
})
const second = deckWith('7b0f2a7e-2a9c-4c6e-9d2b-6a6f1c9d2e12', {
  ...empty,
  main: [
    { printingId: vi, copies: Copies.make(2) },
    { printingId: viAlternate, copies: Copies.make(1) },
  ],
})

describe('missing cards', () => {
  test('a deck uses its legend, chosen champion and every zone', () => {
    expect(copiesUsedBy(first.contents)).toStrictEqual({ [legend]: 1, [vi]: 3 })
  })

  test('the need is the most any one deck uses, per exact printing', () => {
    expect(needs([first, second], {})).toStrictEqual([
      { printingId: vi, needed: 3, owned: 0, missing: 3 },
      { printingId: viAlternate, needed: 1, owned: 0, missing: 1 },
      { printingId: legend, needed: 1, owned: 0, missing: 1 },
    ])
  })

  test('owned copies of that printing reduce what is missing', () => {
    expect(
      missingOnly(
        needs([first, second], {
          [vi]: OwnedQuantity.make(4),
          [legend]: OwnedQuantity.make(1),
        }),
      ),
    ).toStrictEqual([
      { printingId: viAlternate, needed: 1, owned: 0, missing: 1 },
    ])
  })
})
