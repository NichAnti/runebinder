import { Array, Option } from 'effect'
import { describe, expect, test } from 'vitest'

import { printing } from '../testing'
import { OwnedQuantity } from './collection'
import { Copies, type Deck, DeckId, DeckName, empty } from './deck'
import {
  CardId,
  CardTraderBlueprintId,
  CardTraderExpansionCode,
  CardTraderSlug,
  type Printing,
  PrintingId,
  SetCode,
} from './printing'
import {
  cardTraderLinesOf,
  linesOf,
  wantedCopiesOf,
  wantedOf,
} from './wishlist'

const id = PrintingId.make
const vi = id('ogn-066-298')
const viAlternate = id('ogn-066a-298')
const jinx = id('ogn-001-298')

const blueprint = (id: number) => ({
  id: CardTraderBlueprintId.make(id),
  metaName: CardTraderSlug.make('vi-destructive'),
  expansionCode: CardTraderExpansionCode.make('ogn'),
})

const printings: ReadonlyArray<Printing> = [
  printing({
    id: vi,
    cardId: CardId.make('vi'),
    set: SetCode.make('OGN'),
    maybeCardTrader: Option.some(blueprint(10)),
  }),
  printing({
    id: viAlternate,
    cardId: CardId.make('vi'),
    set: SetCode.make('OGN'),
    maybeCardTrader: Option.some(blueprint(11)),
  }),
  printing({
    id: jinx,
    cardId: CardId.make('jinx'),
    set: SetCode.make('OGN'),
    maybeCardTrader: Option.none(),
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

describe('wanted cards', () => {
  const deck: Deck = {
    id: DeckId.make('7b0f2a7e-2a9c-4c6e-9d2b-6a6f1c9d2e11'),
    name: DeckName.make('Vi aggro'),
    contents: {
      ...empty,
      main: [{ printingId: vi, copies: Copies.make(3) }],
    },
  }

  test('decks want what they miss and the custom wishlist adds on top', () => {
    const wanted = wantedOf(
      [deck],
      { [vi]: OwnedQuantity.make(1), [jinx]: OwnedQuantity.make(4) },
      { [jinx]: OwnedQuantity.make(1) },
    )

    expect(wanted).toStrictEqual({
      copies: { [vi]: 2, [jinx]: 1 },
      fromDecks: 2,
      fromCustom: 1,
    })
    expect(wantedCopiesOf(wanted, [vi, viAlternate])).toBe(2)
  })

  test('nothing is wanted when the collection covers every deck', () => {
    expect(
      wantedOf([deck], { [vi]: OwnedQuantity.make(3) }, {}).copies,
    ).toStrictEqual({})
  })
})
