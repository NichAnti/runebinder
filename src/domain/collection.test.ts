import { Option, Schema } from 'effect'
import { describe, expect, test } from 'vitest'

import {
  MAX_QUANTITY,
  NONE,
  OwnedQuantity,
  Quantity,
  adjust,
  fromItems,
  quantityOf,
  summarize,
  toOwned,
  totalOf,
  withQuantity,
} from './collection'
import { PrintingId, SetCode } from './printing'

const vi = PrintingId.make('ogn-066-298')
const viAlternateArt = PrintingId.make('ogn-066a-298')

describe('quantities', () => {
  test('a quantity is a whole number from 0 to the maximum', () => {
    const decode = Schema.decodeOption(Quantity)

    expect(Option.isSome(decode(0))).toBe(true)
    expect(Option.isSome(decode(MAX_QUANTITY))).toBe(true)
    expect(Option.isNone(decode(-1))).toBe(true)
    expect(Option.isNone(decode(MAX_QUANTITY + 1))).toBe(true)
    expect(Option.isNone(decode(1.5))).toBe(true)
  })

  test('adjusting stays within the bounds', () => {
    expect(adjust(NONE, 1)).toBe(1)
    expect(adjust(NONE, -1)).toBe(0)
    expect(adjust(Quantity.make(MAX_QUANTITY), 1)).toBe(MAX_QUANTITY)
  })

  test('zero is not an owned quantity', () => {
    expect(toOwned(NONE)).toStrictEqual(Option.none())
    expect(toOwned(Quantity.make(3))).toStrictEqual(
      Option.some(OwnedQuantity.make(3)),
    )
  })
})

describe('owned printings', () => {
  const owned = fromItems([{ printingId: vi, quantity: OwnedQuantity.make(2) }])

  test('a printing that is not owned has quantity zero', () => {
    expect(quantityOf(owned, viAlternateArt)).toBe(NONE)
    expect(quantityOf(owned, vi)).toBe(2)
  })

  test('setting zero removes the printing', () => {
    expect(withQuantity(owned, vi, NONE)).toStrictEqual({})
    expect(withQuantity(owned, viAlternateArt, Quantity.make(1))).toStrictEqual(
      { [vi]: 2, [viAlternateArt]: 1 },
    )
  })

  test('the total adds every listed printing', () => {
    expect(totalOf(owned, [vi, viAlternateArt])).toBe(2)
  })
})

describe('summary', () => {
  test('counts copies, printings and each set’s progress in release order', () => {
    const jinx = PrintingId.make('unl-001-219')
    const printingSets = {
      [vi]: SetCode.make('OGN'),
      [viAlternateArt]: SetCode.make('OGN'),
      [jinx]: SetCode.make('UNL'),
    }
    const owned = fromItems([
      { printingId: vi, quantity: OwnedQuantity.make(3) },
      { printingId: jinx, quantity: OwnedQuantity.make(1) },
    ])

    expect(summarize(owned, printingSets)).toStrictEqual({
      copies: 4,
      printings: 2,
      sets: [
        { set: 'OGN', ownedPrintings: 1, totalPrintings: 2 },
        { set: 'UNL', ownedPrintings: 1, totalPrintings: 1 },
      ],
    })
  })
})
