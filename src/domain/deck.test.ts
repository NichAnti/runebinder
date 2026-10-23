import { Option, Schema } from 'effect'
import { describe, expect, test } from 'vitest'

import {
  Copies,
  MAX_NAME_LENGTH,
  ZoneCards,
  empty,
  mainDeckSize,
  parseName,
} from './deck'
import { PrintingId } from './printing'

const vi = PrintingId.make('ogn-066-298')

describe('deck names', () => {
  test('a name is trimmed, not empty and not too long', () => {
    expect(parseName('  Vi aggro ')).toStrictEqual(Option.some('Vi aggro'))
    expect(parseName('   ')).toStrictEqual(Option.none())
    expect(parseName('x'.repeat(MAX_NAME_LENGTH + 1))).toStrictEqual(
      Option.none(),
    )
  })
})

describe('zones', () => {
  test('a printing appears once per zone', () => {
    const decode = Schema.decodeUnknownOption(ZoneCards)

    expect(Option.isSome(decode([{ printingId: vi, copies: 3 }]))).toBe(true)
    expect(
      Option.isNone(
        decode([
          { printingId: vi, copies: 1 },
          { printingId: vi, copies: 2 },
        ]),
      ),
    ).toBe(true)
  })

  test('the chosen champion counts toward the main deck', () => {
    expect(
      mainDeckSize({
        ...empty,
        maybeChosenChampion: Option.some(vi),
        main: [{ printingId: vi, copies: Copies.make(2) }],
      }),
    ).toBe(3)
  })
})
