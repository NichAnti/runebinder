import { Array, Option } from 'effect'
import { describe, expect, test } from 'vitest'

import { printing } from '../testing'
import { Copies, type DeckCard, type DeckContents } from './deck'
import { check } from './deckRules'
import {
  CardId,
  type Domain,
  type Printing,
  PrintingId,
  type Supertype,
} from './printing'

const make = (
  id: string,
  type: Printing['maybeType'],
  domains: ReadonlyArray<Domain>,
  options: Readonly<{
    tags?: ReadonlyArray<string>
    supertypes?: ReadonlyArray<Supertype>
    text?: string
  }> = {},
): Printing =>
  printing({
    id: PrintingId.make(id),
    cardId: CardId.make(id),
    name: id,
    maybeSubtitle: Option.none(),
    maybeType: type,
    domains,
    tags: options.tags ?? [],
    supertypes: options.supertypes ?? [],
    maybeText: Option.fromNullishOr(options.text),
  })

const unit: Printing['maybeType'] = Option.some('Unit')
const legend = make('ogn-001-298', Option.some('Legend'), ['Fury', 'Chaos'], {
  tags: ['Jinx'],
})
const champion = make('ogn-002-298', unit, ['Chaos'], {
  tags: ['Jinx'],
  supertypes: ['Champion'],
})
const otherFillers = Array.makeBy(12, index =>
  make(`ogn-${String(100 + index)}-298`, unit, ['Fury']),
)
const firstFiller = make('ogn-099-298', unit, ['Fury'])
const furyRune = make('ogn-007-298', Option.some('Rune'), ['Fury'])
const chaosRune = make('ogn-008-298', Option.some('Rune'), ['Chaos'])
const battlefields = Array.makeBy(3, index =>
  make(`ogn-${String(275 + index)}-298`, Option.some('Battlefield'), [
    'Colorless',
  ]),
)
const firstBattlefield = make('ogn-274-298', Option.some('Battlefield'), [
  'Colorless',
])
const extras = Array.makeBy(11, index =>
  make(`ogn-${String(150 + index)}-298`, unit, ['Fury']),
)
const calmUnit = make('ogn-200-298', unit, ['Calm'])
const spiderling = make('ven-097-166', unit, ['Chaos'], {
  text: 'Your deck can have any number of cards named ven-097-166.',
})
const signature = make('ogn-300-298', unit, ['Fury'], {
  tags: ['Vi'],
  supertypes: ['Signature'],
})

const all = [
  legend,
  champion,
  firstFiller,
  ...otherFillers,
  furyRune,
  chaosRune,
  firstBattlefield,
  ...battlefields,
  ...extras,
  calmUnit,
  spiderling,
  signature,
]
const find = (printingId: PrintingId) =>
  Array.findFirst(all, ({ id }) => id === printingId)

const copies = (target: Printing, count: number): DeckCard => ({
  printingId: target.id,
  copies: Copies.make(count),
})

const legal: DeckContents = {
  maybeLegend: Option.some(legend.id),
  maybeChosenChampion: Option.some(champion.id),
  main: Array.map([firstFiller, ...otherFillers], filler => copies(filler, 3)),
  runes: [copies(furyRune, 6), copies(chaosRune, 6)],
  battlefields: Array.map(battlefields, battlefield => copies(battlefield, 1)),
  sideboard: [],
  additionalLegends: [],
}

const problemsOf = (contents: DeckContents) => {
  const result = check(contents, find)
  return result._tag === 'Checked' ? result.problems : []
}

describe('deck rules', () => {
  test('a constructed deck that follows every rule has no problems', () => {
    expect(check(legal, find)).toStrictEqual({ _tag: 'Checked', problems: [] })
  })

  test('a deck with a card the page has not loaded yet is not checked', () => {
    expect(
      check({ ...legal, sideboard: [copies(make('x-1', unit, []), 1)] }, find),
    ).toStrictEqual({ _tag: 'MissingCards' })
  })

  test('a legend and a chosen champion are required', () => {
    expect(
      problemsOf({
        ...legal,
        maybeLegend: Option.none(),
        maybeChosenChampion: Option.none(),
      }),
    ).toStrictEqual(
      expect.arrayContaining([
        { _tag: 'NoLegend' },
        { _tag: 'NoChosenChampion' },
        { _tag: 'MainDeckTooSmall', size: 39 },
      ]),
    )
  })

  test('the chosen champion counts toward the copy limit', () => {
    expect(
      problemsOf({
        ...legal,
        main: [...legal.main, copies(champion, 3)],
      }),
    ).toStrictEqual(
      expect.arrayContaining([
        {
          _tag: 'TooManyCopies',
          cardId: champion.cardId,
          copies: 4,
          isCountingSideboard: false,
        },
      ]),
    )
  })

  test('the copy limit counts the sideboard too', () => {
    expect(
      problemsOf({ ...legal, sideboard: [copies(firstFiller, 1)] }),
    ).toStrictEqual([
      {
        _tag: 'TooManyCopies',
        cardId: firstFiller.cardId,
        copies: 4,
        isCountingSideboard: true,
      },
    ])
  })

  test('a card that allows any number of copies is not limited', () => {
    expect(
      problemsOf({ ...legal, sideboard: [copies(spiderling, 8)] }),
    ).toStrictEqual([])
  })

  test('cards must stay within the legend’s domains', () => {
    expect(
      problemsOf({ ...legal, sideboard: [copies(calmUnit, 1)] }),
    ).toStrictEqual([
      {
        _tag: 'OutsideDomainIdentity',
        cardId: calmUnit.cardId,
        part: 'Sideboard',
      },
    ])
  })

  test('signature cards must share the legend’s champion tag', () => {
    expect(
      problemsOf({
        ...legal,
        main: [...legal.main.slice(1), copies(signature, 3)],
      }),
    ).toStrictEqual([
      { _tag: 'SignatureTagMismatch', cardId: signature.cardId },
    ])
  })

  test('constructed sizes are exact and battlefields are unique', () => {
    expect(
      problemsOf({
        ...legal,
        runes: [copies(furyRune, 11)],
        battlefields: [copies(firstBattlefield, 2)],
        sideboard: Array.map(extras, extra => copies(extra, 1)),
      }),
    ).toStrictEqual(
      expect.arrayContaining([
        { _tag: 'RuneDeckNotTwelve', size: 11 },
        { _tag: 'BattlefieldsNotThree', count: 2 },
        { _tag: 'SideboardTooLarge', size: 11 },
        {
          _tag: 'DuplicateBattlefield',
          cardId: firstBattlefield.cardId,
        },
      ]),
    )
  })
})
