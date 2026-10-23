import { Option } from 'effect'
import { describe, expect, test } from 'vitest'

import { Copies, empty } from './deck'
import { structureProblems } from './deckStructure'
import { type CardType, PrintingId } from './printing'

const TYPES: Readonly<Record<string, CardType>> = {
  'ogn-261-298': 'Legend',
  'ogn-103-298': 'Unit',
  'ogn-007-298': 'Rune',
  'ogn-275-298': 'Battlefield',
}

const find = (printingId: PrintingId) =>
  Option.map(Option.fromNullishOr(TYPES[printingId]), type => ({
    printingId,
    maybeType: Option.some(type),
  }))

const id = PrintingId.make
const one = (printingId: string) => [
  { printingId: id(printingId), copies: Copies.make(1) },
]

describe('deck structure', () => {
  test('each part holds the card types it allows', () => {
    expect(
      structureProblems(
        {
          ...empty,
          maybeLegend: Option.some(id('ogn-261-298')),
          maybeChosenChampion: Option.some(id('ogn-103-298')),
          main: one('ogn-103-298'),
          runes: one('ogn-007-298'),
          battlefields: one('ogn-275-298'),
        },
        find,
      ),
    ).toStrictEqual([])
  })

  test('a card in the wrong part is reported with where it is', () => {
    expect(
      structureProblems(
        {
          ...empty,
          maybeLegend: Option.some(id('ogn-103-298')),
          main: one('ogn-007-298'),
        },
        find,
      ),
    ).toStrictEqual([
      { _tag: 'WrongCardType', place: 'Legend', printingId: id('ogn-103-298') },
      { _tag: 'WrongCardType', place: 'Main', printingId: id('ogn-007-298') },
    ])
  })

  test('a printing the catalogue does not have is reported', () => {
    expect(
      structureProblems({ ...empty, sideboard: one('ogn-999-298') }, find),
    ).toStrictEqual([
      {
        _tag: 'UnknownPrinting',
        place: 'Sideboard',
        printingId: id('ogn-999-298'),
      },
    ])
  })
})
