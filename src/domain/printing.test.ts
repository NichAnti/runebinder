import { Array, Option } from 'effect'
import { describe, expect, test } from 'vitest'

import * as Printing from './printing'

const printing = (
  id: string,
  cardId: string,
  variant: Printing.Variant,
): Printing.Printing =>
  Printing.Printing.make({
    id: Printing.PrintingId.make(id),
    cardId: Printing.CardId.make(cardId),
    set: Printing.SetCode.make('TST'),
    collectorNumber: 1,
    publicCode: 'TST-001/010',
    variant,
    name: 'Test Unit',
    maybeSubtitle: Option.none(),
    maybeType: Option.some('Unit'),
    supertypes: [],
    rarity: 'Common',
    domains: ['Fury'],
    maybeEnergy: Option.some(1),
    maybeMight: Option.some(1),
    maybeMightBonus: Option.none(),
    maybePower: Option.none(),
    tags: [],
    maybeText: Option.none(),
    maybeEffect: Option.none(),
    artists: [],
    imageUrl: 'https://example.com/test.png',
    maybeAccessibilityText: Option.none(),
    orientation: 'Portrait',
    maybeCardTrader: Option.none(),
  })

describe('cardIdFor', () => {
  test('combines name and subtitle into a slug', () => {
    expect(
      Printing.cardIdFor('Vi', Option.some('Piltover Enforcer')),
    ).toStrictEqual(Option.some('vi-piltover-enforcer'))
  })

  test('drops punctuation and accents', () => {
    expect(
      Printing.cardIdFor("Kha'Zix", Option.some('Évolution')),
    ).toStrictEqual(Option.some('kha-zix-evolution'))
  })

  test('a name with nothing to slug has no card id', () => {
    expect(Printing.cardIdFor('!!!', Option.none())).toStrictEqual(
      Option.none(),
    )
  })
})

describe('groupByCard', () => {
  test('groups printings by card id in their original order', () => {
    const cards = Printing.groupByCard([
      printing('tst-001-010', 'test-unit', 'Base'),
      printing('tst-002-010', 'other-unit', 'Base'),
      printing('tst-001a-010', 'test-unit', 'AlternateArt'),
    ])

    expect(
      Array.map(cards, card => [
        card.id,
        Array.map(card.printings, ({ id }) => id),
      ]),
    ).toStrictEqual([
      ['test-unit', ['tst-001-010', 'tst-001a-010']],
      ['other-unit', ['tst-002-010']],
    ])
  })
})

describe('basePrinting', () => {
  test('prefers the base printing', () => {
    const [card] = Printing.groupByCard([
      printing('tst-001a-010', 'test-unit', 'AlternateArt'),
      printing('tst-001-010', 'test-unit', 'Base'),
    ])

    expect(card && Printing.basePrinting(card).id).toBe('tst-001-010')
  })

  test('falls back to the first printing when there is no base', () => {
    const [card] = Printing.groupByCard([
      printing('tst-011-010', 'test-unit', 'Overnumbered'),
      printing('tst-011-star-010', 'test-unit', 'Signature'),
    ])

    expect(card && Printing.basePrinting(card).id).toBe('tst-011-010')
  })
})
