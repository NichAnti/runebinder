import { Option } from 'effect'
import { describe, expect, test } from 'vitest'

import { parseId, variantFor } from './toPrinting'

describe('parseId', () => {
  test.each([
    ['tst-001-010', 'tst', 1, false, false, Option.some(10)],
    ['tst-001a-010', 'tst', 1, true, false, Option.some(10)],
    ['tst-011-star-010', 'tst', 11, false, true, Option.some(10)],
    ['tst-r01', 'tst', 1, false, false, Option.none()],
    ['tst-sp2-006', 'tst', 2, false, false, Option.some(6)],
  ])('%s', (id, set, number, isAlternateArt, isSigned, maybeSetSize) => {
    expect(parseId(id)).toStrictEqual(
      Option.some({ set, number, isAlternateArt, isSigned, maybeSetSize }),
    )
  })

  test('an id in another format does not parse', () => {
    expect(parseId('TST-001/010')).toStrictEqual(Option.none())
  })
})

describe('variantFor', () => {
  const parts = {
    set: 'tst',
    number: 1,
    isAlternateArt: false,
    isSigned: false,
    maybeSetSize: Option.some(10),
  }

  test('a number within the set is Base', () => {
    expect(variantFor(parts)).toBe('Base')
  })

  test('a number beyond the set size is Overnumbered', () => {
    expect(variantFor({ ...parts, number: 11 })).toBe('Overnumbered')
  })

  test('the alternate-art marker wins over the number', () => {
    expect(variantFor({ ...parts, isAlternateArt: true })).toBe('AlternateArt')
  })

  test('the signed marker wins over everything', () => {
    expect(
      variantFor({
        ...parts,
        number: 11,
        isAlternateArt: true,
        isSigned: true,
      }),
    ).toBe('Signature')
  })

  test('without a set size nothing is Overnumbered', () => {
    expect(
      variantFor({ ...parts, number: 99, maybeSetSize: Option.none() }),
    ).toBe('Base')
  })
})
