import { Array, Effect, Match, Option, Record, Result, pipe } from 'effect'

import { create, insertMultiple, search } from '@orama/orama'

import {
  CardText,
  CatalogueQuery,
  CatalogueSearch,
  Collection,
  DeckRules,
  Printing,
} from '../domain'

// DATABASE

const createDatabase = () =>
  create({
    schema: {
      id: 'string',
      cardKey: 'enum',
      name: 'string',
      subtitle: 'string',
      keywordText: 'string',
      tagText: 'string',
      text: 'string',
      artists: 'string',
      set: 'enum[]',
      type: 'enum',
      supertype: 'enum[]',
      domain: 'enum[]',
      rarity: 'enum[]',
      variant: 'enum[]',
      keyword: 'enum[]',
      tag: 'enum[]',
      energy: 'number',
      might: 'number',
      power: 'number',
      order: 'number',
      sortName: 'string',
    },
  })

type Database = ReturnType<typeof createDatabase>

export type CatalogueIndex = Readonly<{
  database: Database
  cards: ReadonlyMap<string, Printing.Card>
  cardIdByPrinting: ReadonlyMap<string, Printing.CardId>
  printingsByCardTraderKey: ReadonlyMap<
    string,
    ReadonlyArray<Printing.Printing>
  >
  printingSets: Collection.PrintingSets
  allValues: CatalogueSearch.Facets
}>

const TEXT_BOOST = {
  name: 4,
  subtitle: 3,
  keywordText: 2,
  tagText: 2,
  text: 1,
  artists: 1,
}

const TEXT_PROPERTIES: Array<keyof typeof TEXT_BOOST> = [
  'name',
  'subtitle',
  'keywordText',
  'tagText',
  'text',
  'artists',
]

const TYPO_TOLERANCE = 1
const FACET_VALUE_LIMIT = 1000

// DOCUMENTS

const parsedText = (maybeHtml: Option.Option<string>): CardText.CardText =>
  pipe(
    maybeHtml,
    Option.flatMap(html => Result.getSuccess(CardText.parse(html))),
    Option.getOrElse(() => []),
  )

const uniqueAcross = <A>(
  card: Printing.Card,
  pick: (printing: Printing.Printing) => ReadonlyArray<A>,
): Array<A> => Array.dedupe(Array.flatMap(card.printings, pick))

const optionalField = <K extends string, A>(
  key: K,
  maybeValue: Option.Option<A>,
): Partial<Record<K, A>> =>
  Option.match(maybeValue, {
    onNone: () => ({}),
    onSome: value => Record.singleton(key, value),
  })

const toDocument = (card: Printing.Card) => {
  const base = Printing.basePrinting(card)
  const text = [...parsedText(base.maybeText), ...parsedText(base.maybeEffect)]
  const keywords = Array.fromIterable(CardText.keywords(text))
  const tags = uniqueAcross(card, ({ tags }) => tags)
  const subtitle = Option.getOrElse(base.maybeSubtitle, () => '')

  return {
    id: card.id,
    cardKey: card.id,
    name: base.name,
    subtitle,
    keywordText: Array.join(keywords, ' '),
    tagText: Array.join(tags, ' '),
    text: CardText.plainText(text),
    artists: Array.join(
      uniqueAcross(card, ({ artists }) => artists),
      ' ',
    ),
    set: uniqueAcross(card, ({ set }) => [set]),
    supertype: uniqueAcross(card, ({ supertypes }) => supertypes),
    domain: Array.fromIterable(base.domains),
    rarity: uniqueAcross(card, ({ rarity }) => [rarity]),
    variant: uniqueAcross(card, ({ variant }) => [variant]),
    keyword: keywords,
    tag: tags,
    order: Printing.collectionOrder(base),
    sortName: `${base.name} ${subtitle}`,
    ...optionalField('type', base.maybeType),
    ...optionalField('energy', base.maybeEnergy),
    ...optionalField('might', base.maybeMight),
    ...optionalField('power', base.maybePower),
  }
}

// QUERY

const anyOf = (
  values: ReadonlyArray<string>,
): Option.Option<{ containsAny: Array<string> }> =>
  Array.isReadonlyArrayNonEmpty(values)
    ? Option.some({ containsAny: Array.fromIterable(values) })
    : Option.none()

const oneOf = (
  values: ReadonlyArray<string>,
): Option.Option<{ in: Array<string> }> =>
  Array.isReadonlyArrayNonEmpty(values)
    ? Option.some({ in: Array.fromIterable(values) })
    : Option.none()

type RangeCondition =
  | Readonly<{ between: [number, number] }>
  | Readonly<{ gte: number }>
  | Readonly<{ lte: number }>

const within = (range: CatalogueQuery.Range): Option.Option<RangeCondition> =>
  Option.match(range.maybeMin, {
    onNone: () =>
      Option.map(range.maybeMax, (max): RangeCondition => ({ lte: max })),
    onSome: min =>
      Option.some(
        Option.match(range.maybeMax, {
          onNone: (): RangeCondition => ({ gte: min }),
          onSome: (max): RangeCondition => ({ between: [min, max] }),
        }),
      ),
  })

const viewCondition = (
  ownership: CatalogueQuery.Ownership,
  viewCardIds: ReadonlyArray<Printing.CardId>,
): Option.Option<{ in: Array<string> }> =>
  ownership === 'All'
    ? Option.none()
    : Option.some({ in: Array.fromIterable(viewCardIds) })

const whereFor = (
  query: CatalogueQuery.Query,
  viewCardIds: ReadonlyArray<Printing.CardId>,
  maybeExcluded: Option.Option<CatalogueSearch.FacetName>,
) => {
  const unless = <A>(
    facet: CatalogueSearch.FacetName,
    maybeCondition: Option.Option<A>,
  ): Option.Option<A> =>
    Option.exists(maybeExcluded, excluded => excluded === facet)
      ? Option.none()
      : maybeCondition

  return {
    ...optionalField('set', unless('set', anyOf(query.set))),
    ...optionalField('type', unless('type', oneOf(query.type))),
    ...optionalField('supertype', unless('supertype', anyOf(query.supertype))),
    ...optionalField('domain', unless('domain', anyOf(query.domain))),
    ...optionalField('rarity', unless('rarity', anyOf(query.rarity))),
    ...optionalField('variant', unless('variant', anyOf(query.variant))),
    ...optionalField('keyword', unless('keyword', anyOf(query.keyword))),
    ...optionalField('tag', unless('tag', anyOf(query.tag))),
    ...optionalField('energy', within(query.energy)),
    ...optionalField('might', within(query.might)),
    ...optionalField('power', within(query.power)),
    ...optionalField('cardKey', viewCondition(query.ownership, viewCardIds)),
  }
}

const sortProperty = (field: CatalogueQuery.SortField): Option.Option<string> =>
  Match.value(field).pipe(
    Match.withReturnType<Option.Option<string>>(),
    Match.when('Relevance', () => Option.none()),
    Match.when('Name', () => Option.some('sortName')),
    Match.when('Number', () => Option.some('order')),
    Match.when('Energy', () => Option.some('energy')),
    Match.when('Might', () => Option.some('might')),
    Match.when('Power', () => Option.some('power')),
    Match.exhaustive,
  )

const sortOrder = (direction: CatalogueQuery.SortDirection): 'ASC' | 'DESC' =>
  direction === 'Ascending' ? 'ASC' : 'DESC'

const sortBy = (sort: CatalogueQuery.Sort) =>
  Option.match(sortProperty(sort.field), {
    onNone: () => ({}),
    onSome: property => ({
      sortBy: { property, order: sortOrder(sort.direction) },
    }),
  })

const textSearch = (query: CatalogueQuery.Query) =>
  Option.match(query.q, {
    onNone: () => ({}),
    onSome: term => ({
      term,
      properties: TEXT_PROPERTIES,
      boost: TEXT_BOOST,
      tolerance: TYPO_TOLERANCE,
    }),
  })

// RESULTS

const toSummary = (card: Printing.Card): CatalogueSearch.CardSummary => {
  const base = Printing.basePrinting(card)

  return {
    id: card.id,
    name: base.name,
    maybeSubtitle: base.maybeSubtitle,
    maybeType: base.maybeType,
    domains: base.domains,
    imageUrl: base.imageUrl,
    maybeAccessibilityText: base.maybeAccessibilityText,
    printingIds: Array.map(card.printings, ({ id }) => id),
    maybeCopyLimit: DeckRules.copyLimitOf(base),
  }
}

const facetValues = (
  facets: Record<string, { values: Record<string, number> }> | undefined,
  facet: CatalogueSearch.FacetName,
): ReadonlyArray<CatalogueSearch.FacetValue> =>
  pipe(
    Option.fromNullishOr(facets?.[facet]),
    Option.map(({ values }) =>
      Array.map(Record.toEntries(values), ([value, count]) => ({
        value,
        count,
      })),
    ),
    Option.getOrElse(() => []),
  )

const facetCounts = (
  database: Database,
  query: CatalogueQuery.Query,
  viewCardIds: ReadonlyArray<Printing.CardId>,
  facet: CatalogueSearch.FacetName,
) =>
  Effect.promise(async () =>
    facetValues(
      (
        await search(database, {
          ...textSearch(query),
          where: whereFor(query, viewCardIds, Option.some(facet)),
          facets: { [facet]: { limit: FACET_VALUE_LIMIT } },
          limit: 0,
        })
      ).facets,
      facet,
    ),
  )

const FACET_NAMES = CatalogueSearch.FacetName.literals

const allFacetCounts = (
  database: Database,
  query: CatalogueQuery.Query,
  viewCardIds: ReadonlyArray<Printing.CardId>,
) =>
  Effect.all(
    Record.fromIterableWith(FACET_NAMES, facet => [
      facet,
      facetCounts(database, query, viewCardIds, facet),
    ]),
  ).pipe(
    Effect.map((counts): CatalogueSearch.Facets => ({
      set: counts.set ?? [],
      type: counts.type ?? [],
      supertype: counts.supertype ?? [],
      domain: counts.domain ?? [],
      rarity: counts.rarity ?? [],
      variant: counts.variant ?? [],
      keyword: counts.keyword ?? [],
      tag: counts.tag ?? [],
    })),
  )

// PUBLIC

export const build = (printings: ReadonlyArray<Printing.Printing>) =>
  Effect.gen(function* () {
    const database = createDatabase()
    const cards = Printing.groupByCard(printings)

    yield* Effect.promise(async () =>
      insertMultiple(database, Array.map(cards, toDocument)),
    )

    const allValues = yield* allFacetCounts(database, CatalogueQuery.empty, [])

    return {
      database,
      cards: new Map(Array.map(cards, card => [card.id, card])),
      cardIdByPrinting: new Map(
        Array.flatMap(cards, card =>
          Array.map(
            card.printings,
            ({ id }): readonly [string, Printing.CardId] => [id, card.id],
          ),
        ),
      ),
      printingsByCardTraderKey: new Map(
        pipe(
          Array.filterMap(printings, printing =>
            Result.fromOption(
              Option.map(printing.maybeCardTrader, blueprint => ({
                key: Printing.cardTraderKey(blueprint),
                printing,
              })),
              () => printing.id,
            ),
          ),
          Array.groupBy(({ key }) => key),
          Record.toEntries,
          Array.map(
            ([key, group]): readonly [
              string,
              ReadonlyArray<Printing.Printing>,
            ] => [key, Array.map(group, ({ printing }) => printing)],
          ),
        ),
      ),
      printingSets: Record.fromEntries(
        Array.map(printings, ({ id, set }) => [id, set]),
      ),
      allValues,
    } satisfies CatalogueIndex
  })

export const cardIdsOwning = (
  index: CatalogueIndex,
  printingIds: ReadonlyArray<Printing.PrintingId>,
): ReadonlyArray<Printing.CardId> =>
  Array.dedupe(
    Array.filterMap(printingIds, id =>
      Result.fromOption(
        Option.fromNullishOr(index.cardIdByPrinting.get(id)),
        () => id,
      ),
    ),
  )

export const searchCards = (
  index: CatalogueIndex,
  query: CatalogueQuery.Query,
  limit: number,
  viewPrintingIds: ReadonlyArray<Printing.PrintingId>,
): Effect.Effect<CatalogueSearch.SearchResult> =>
  Effect.gen(function* () {
    const viewCardIds = cardIdsOwning(index, viewPrintingIds)
    const results = yield* Effect.promise(async () =>
      search(index.database, {
        ...textSearch(query),
        ...sortBy(CatalogueQuery.effectiveSort(query)),
        where: whereFor(query, viewCardIds, Option.none()),
        limit,
      }),
    )

    const facets = yield* allFacetCounts(index.database, query, viewCardIds)

    return {
      total: results.count,
      cards: pipe(
        results.hits,
        Array.filterMap(({ id }) =>
          Result.fromOption(
            Option.fromNullishOr(index.cards.get(id)),
            () => id,
          ),
        ),
        Array.map(toSummary),
      ),
      facets,
    }
  })

export const cardById = (
  index: CatalogueIndex,
  id: Printing.CardId,
): Option.Option<Printing.Card> => Option.fromNullishOr(index.cards.get(id))

export const printingsForCardTrader = (
  index: CatalogueIndex,
  key: string,
): ReadonlyArray<Printing.Printing> =>
  Option.getOrElse(
    Option.fromNullishOr(index.printingsByCardTraderKey.get(key)),
    (): ReadonlyArray<Printing.Printing> => [],
  )
