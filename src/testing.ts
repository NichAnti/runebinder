import { Array, Option } from 'effect'

import { CatalogueQuery, CatalogueSearch, Printing, User } from './domain'

export const ada = User.User.make({
  id: User.UserId.make('user-ada'),
  name: 'Ada',
  email: 'ada@example.com',
})

export const printing = (
  overrides: Partial<Printing.Printing> = {},
): Printing.Printing => ({
  id: Printing.PrintingId.make('tst-001-010'),
  cardId: Printing.CardId.make('test-unit'),
  set: Printing.SetCode.make('TST'),
  collectorNumber: 1,
  publicCode: 'TST-001/010',
  variant: 'Base',
  name: 'Test Unit',
  maybeSubtitle: Option.some('Tester'),
  maybeType: Option.some('Unit'),
  supertypes: ['Champion'],
  rarity: 'Rare',
  domains: ['Fury', 'Calm'],
  maybeEnergy: Option.some(3),
  maybeMight: Option.some(2),
  maybeMightBonus: Option.none(),
  maybePower: Option.none(),
  tags: ['Testing'],
  maybeText: Option.some(
    '<p>[Tank] Pay :rb_energy_1: and :rb_rune_fury: to draw 1.</p>',
  ),
  maybeEffect: Option.none(),
  artists: ['Test Artist'],
  imageUrl: 'https://example.com/test-unit.png',
  maybeAccessibilityText: Option.some('Test Unit artwork'),
  orientation: 'Portrait',
  maybeCardTrader: Option.none(),
  ...overrides,
})

export const testCard: Printing.Card = {
  id: Printing.CardId.make('test-unit'),
  printings: [
    printing(),
    printing({
      id: Printing.PrintingId.make('tst-001a-010'),
      publicCode: 'TST-001a/010',
      variant: 'AlternateArt',
      rarity: 'Showcase',
      imageUrl: 'https://example.com/test-unit-alt.png',
    }),
  ],
}

const facetValues = (
  values: ReadonlyArray<readonly [string, number]>,
): ReadonlyArray<CatalogueSearch.FacetValue> =>
  Array.map(values, ([value, count]) => ({ value, count }))

export const allValues: CatalogueSearch.Facets = {
  set: facetValues([['TST', 2]]),
  type: facetValues([
    ['Unit', 1],
    ['Spell', 1],
  ]),
  supertype: facetValues([['Champion', 1]]),
  domain: facetValues([
    ['Fury', 2],
    ['Calm', 1],
  ]),
  rarity: facetValues([['Rare', 2]]),
  variant: facetValues([
    ['Base', 2],
    ['AlternateArt', 1],
  ]),
  keyword: facetValues([['Tank', 1]]),
  tag: facetValues([['Testing', 2]]),
}

export const searchResult: CatalogueSearch.SearchResult = {
  total: 1,
  cards: [
    {
      id: testCard.id,
      name: 'Test Unit',
      maybeSubtitle: Option.some('Tester'),
      maybeType: Option.some('Unit'),
      domains: ['Fury', 'Calm'],
      imageUrl: 'https://example.com/test-unit.png',
      maybeAccessibilityText: Option.some('Test Unit artwork'),
      printingIds: [
        Printing.PrintingId.make('tst-001-010'),
        Printing.PrintingId.make('tst-001a-010'),
      ],
    },
  ],
  facets: {
    ...allValues,
    domain: facetValues([
      ['Fury', 1],
      ['Calm', 1],
    ]),
    type: facetValues([['Unit', 1]]),
  },
}

export const emptyQuery = CatalogueQuery.empty
