import { Array, Option } from 'effect'
import { describe, expect, test } from 'vitest'

import { printing } from '../testing'
import { OwnedQuantity } from './collection'
import {
  CardId,
  CardTraderBlueprintId,
  type Printing,
  PrintingId,
  SetCode,
} from './printing'
import { cardTraderLinesOf, linesOf } from './wishlist'

const id = PrintingId.make
const vi = id('ogn-066-298')
const viAlternate = id('ogn-066a-298')
const jinx = id('ogn-001-298')

const printings: ReadonlyArray<Printing> = [
  printing({
    id: vi,
    cardId: CardId.make('vi'),
    set: SetCode.make('OGN'),
    maybeCardTraderBlueprintId: Option.some(CardTraderBlueprintId.make(10)),
  }),
  printing({
    id: viAlternate,
    cardId: CardId.make('vi'),
    set: SetCode.make('OGN'),
    maybeCardTraderBlueprintId: Option.some(CardTraderBlueprintId.make(11)),
  }),
  printing({
    id: jinx,
    cardId: CardId.make('jinx'),
    set: SetCode.make('OGN'),
    maybeCardTraderBlueprintId: Option.none(),
  }),
]
const find = (printingId: PrintingId) =>
  Array.findFirst(printings, printing => printing.id === printingId)

describe('wishlist lines', () => {
  test('a line adds what decks miss to what was added by hand', () => {
    expect(
      linesOf(
        [
          { printingId: vi, needed: 3, owned: 1, missing: 2 },
          { printingId: jinx, needed: 1, owned: 1, missing: 0 },
        ],
        { [vi]: OwnedQuantity.make(1), [viAlternate]: OwnedQuantity.make(2) },
      ),
    ).toStrictEqual([
      { printingId: vi, missing: 2, added: 1, quantity: 3 },
      { printingId: viAlternate, missing: 0, added: 2, quantity: 2 },
    ])
  })

  test('CardTrader gets one line per card and set, with versions added up', () => {
    expect(
      cardTraderLinesOf(
        [
          { printingId: vi, missing: 2, added: 0, quantity: 2 },
          { printingId: viAlternate, missing: 1, added: 0, quantity: 1 },
          { printingId: jinx, missing: 1, added: 0, quantity: 1 },
        ],
        find,
      ),
    ).toStrictEqual({
      lines: [{ blueprintId: 10, quantity: 3 }],
      notOnCardTrader: [jinx],
    })
  })
})
