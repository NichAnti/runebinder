import { Option, Schema } from 'effect'
import { describe, expect, test } from 'vitest'

import { MAX_QUANTITY, OwnedQuantity, Quantity, toOwned } from './collection'

describe('quantities', () => {
  test('a quantity is a whole number from 0 to the maximum', () => {
    const decode = Schema.decodeOption(Quantity)

    expect(Option.isSome(decode(0))).toBe(true)
    expect(Option.isSome(decode(MAX_QUANTITY))).toBe(true)
    expect(Option.isNone(decode(-1))).toBe(true)
    expect(Option.isNone(decode(MAX_QUANTITY + 1))).toBe(true)
    expect(Option.isNone(decode(1.5))).toBe(true)
  })

  test('zero is not an owned quantity', () => {
    expect(toOwned(Quantity.make(0))).toStrictEqual(Option.none())
    expect(toOwned(Quantity.make(3))).toStrictEqual(
      Option.some(OwnedQuantity.make(3)),
    )
  })
})
