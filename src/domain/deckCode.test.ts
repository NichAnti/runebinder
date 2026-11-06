import { Arbitrary, Array, Option, Result, Schema } from 'effect'
import { describe, expect, test } from 'vitest'

import { prop } from '@effect/vitest'
import { getCodeFromDeck } from '@piltoverarchive/riftbound-deck-codes'

import { printing } from '../testing'
import { Copies, type DeckContents, empty } from './deck'
import { canonical, decode, encode, lookupFrom } from './deckCode'
import { type CardType, PrintingId, SetCode } from './printing'

const fixture = (id: string, type: CardType): ReturnType<typeof printing> =>
  printing({
    id: PrintingId.make(id),
    set: SetCode.make(id.slice(0, 3).toUpperCase()),
    maybeType: Option.some(type),
  })

const LEGENDS = ['ogn-261-298', 'ogn-262-298', 'ogn-263-298']
const UNITS = [
  'ogn-103-298',
  'ogn-103a-298',
  'ogn-004-298',
  'ogn-009-298',
  'ogn-304-star-298',
  'rad-sp1-005',
]
const RUNES = ['ven-r04', 'ven-r05']
const BATTLEFIELDS = ['ogn-275-298', 'ogn-276-298', 'ogn-277-298']

const lookup = lookupFrom([
  ...Array.map(LEGENDS, id => fixture(id, 'Legend')),
  ...Array.map(UNITS, id => fixture(id, 'Unit')),
  ...Array.map(RUNES, id => fixture(id, 'Rune')),
  ...Array.map(BATTLEFIELDS, id => fixture(id, 'Battlefield')),
])

const id = PrintingId.make
const card = (printingId: string, copies: number) => ({
  printingId: id(printingId),
  copies: Copies.make(copies),
})

const fullDeck: DeckContents = {
  maybeLegend: Option.some(id('ogn-261-298')),
  maybeChosenChampion: Option.some(id('ogn-103a-298')),
  main: [
    card('ogn-103-298', 2),
    card('ogn-004-298', 3),
    card('rad-sp1-005', 1),
  ],
  runes: [card('ven-r04', 7), card('ven-r05', 5)],
  battlefields: [
    card('ogn-275-298', 1),
    card('ogn-276-298', 1),
    card('ogn-277-298', 1),
  ],
  sideboard: [card('ogn-009-298', 2)],
  additionalLegends: [id('ogn-263-298'), id('ogn-262-298')],
}

const roundTrip = (contents: DeckContents) =>
  Result.flatMap(encode(contents), code => decode(code, lookup))

describe('deck codes', () => {
  test('a full deck survives export and import', () => {
    expect(roundTrip(fullDeck)).toStrictEqual(
      Result.succeed(canonical(fullDeck)),
    )
  })

  test('an empty deck survives export and import', () => {
    expect(roundTrip(empty)).toStrictEqual(Result.succeed(empty))
  })

  const zone = (ids: ReadonlyArray<string>) =>
    Arbitrary.array(
      Arbitrary.all({
        printingId: Arbitrary.schema(Schema.Literals(ids)),
        copies: Arbitrary.schema(Schema.Literals([1, 2, 3])),
      }),
    ).pipe(
      Arbitrary.map(cards =>
        Array.dedupeWith(cards, (a, b) => a.printingId === b.printingId),
      ),
      Arbitrary.map(
        Array.map(({ printingId, copies }) => card(printingId, copies)),
      ),
    )

  const optionalOf = (ids: ReadonlyArray<string>) =>
    Arbitrary.schema(Schema.Option(Schema.Literals(ids))).pipe(
      Arbitrary.map(Option.map(id)),
    )

  prop(
    'every deck survives export and import',
    {
      contents: Arbitrary.all({
        maybeLegend: optionalOf(LEGENDS),
        maybeChosenChampion: optionalOf(UNITS),
        main: zone(UNITS),
        runes: zone(RUNES),
        battlefields: zone(BATTLEFIELDS),
        sideboard: zone(UNITS),
        additionalLegends: Arbitrary.array(
          Arbitrary.schema(Schema.Literals(LEGENDS)),
        ).pipe(Arbitrary.map(Array.map(value => id(value)))),
      }),
    },
    ({ contents }) => {
      expect(roundTrip(contents)).toStrictEqual(
        Result.succeed(canonical(contents)),
      )
    },
  )

  test('a signed card may be written with *', () => {
    const code = getCodeFromDeck([{ cardCode: 'OGN-304*', count: 2 }])

    expect(decode(code, lookup)).toStrictEqual(
      Result.succeed({ ...empty, main: [card('ogn-304-star-298', 2)] }),
    )
  })

  test('a code that is not a deck code is unreadable', () => {
    expect(decode('not a deck', lookup)).toStrictEqual(
      Result.fail({ _tag: 'Unreadable' }),
    )
  })

  test('a card the catalogue does not know is named', () => {
    const code = getCodeFromDeck([{ cardCode: 'OGN-200', count: 1 }])

    expect(decode(code, lookup)).toStrictEqual(
      Result.fail({ _tag: 'UnknownCard', cardCode: 'OGN-200' }),
    )
  })

  test('two starting legends cannot be told apart', () => {
    const code = getCodeFromDeck([
      { cardCode: 'OGN-261', count: 1 },
      { cardCode: 'OGN-262', count: 1 },
    ])

    expect(decode(code, lookup)).toStrictEqual(
      Result.fail({ _tag: 'SeveralLegends' }),
    )
  })

  test('a chosen champion must be in the main deck', () => {
    const code = getCodeFromDeck(
      [{ cardCode: 'OGN-004', count: 3 }],
      [],
      'OGN-103',
    )

    expect(decode(code, lookup)).toStrictEqual(
      Result.fail({ _tag: 'ChampionNotInMainDeck', cardCode: 'OGN-103' }),
    )
  })
})
