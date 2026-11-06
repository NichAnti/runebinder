import { Option } from 'effect'
import { describe, expect, test } from 'vitest'

import { CardCode, cardCodeOf, normalizeCardCode } from './cardCode'
import { PrintingId } from './printing'

const codeOf = (id: string) => cardCodeOf(PrintingId.make(id))

describe('card codes', () => {
  test('a printing becomes its deck card code', () => {
    expect(codeOf('ogn-066-298')).toStrictEqual(
      Option.some(CardCode.make('OGN-066')),
    )
    expect(codeOf('ogn-066a-298')).toStrictEqual(
      Option.some(CardCode.make('OGN-066a')),
    )
    expect(codeOf('ogn-304-star-298')).toStrictEqual(
      Option.some(CardCode.make('OGN-304s')),
    )
    expect(codeOf('ven-r04')).toStrictEqual(
      Option.some(CardCode.make('VEN-R04')),
    )
    expect(codeOf('rad-sp1-005')).toStrictEqual(
      Option.some(CardCode.make('RAD-SP1')),
    )
  })

  test('tokens have no deck card code', () => {
    expect(codeOf('ogn-t01')).toStrictEqual(Option.none())
  })

  test('a signed card written with * reads as s', () => {
    expect(normalizeCardCode('OGN-304*')).toStrictEqual(
      Option.some(CardCode.make('OGN-304s')),
    )
    expect(normalizeCardCode('not a code')).toStrictEqual(Option.none())
  })
})
