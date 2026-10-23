import {
  Array,
  Match,
  Number,
  Option,
  Schema,
  SchemaTransformation,
  String,
  pipe,
} from 'effect'

import type { FacetName } from './catalogueSearch'
import {
  CardType,
  Domain,
  Rarity,
  SetCode,
  Supertype,
  Variant,
} from './printing'

// SORT

export const SortField = Schema.Literals([
  'Relevance',
  'Name',
  'Number',
  'Energy',
  'Might',
  'Power',
])
export type SortField = typeof SortField.Type

export const SortDirection = Schema.Literals(['Ascending', 'Descending'])
export type SortDirection = typeof SortDirection.Type

export const Sort = Schema.Struct({
  field: SortField,
  direction: SortDirection,
})
export type Sort = typeof Sort.Type

// RANGE

export const Range = Schema.Struct({
  maybeMin: Schema.Option(Schema.Int),
  maybeMax: Schema.Option(Schema.Int),
})
export type Range = typeof Range.Type

export const anyRange: Range = {
  maybeMin: Option.none(),
  maybeMax: Option.none(),
}

export const isAnyRange = (range: Range): boolean =>
  Option.isNone(range.maybeMin) && Option.isNone(range.maybeMax)

// OWNERSHIP

export const Ownership = Schema.Literals(['All', 'Owned', 'NotOwned'])
export type Ownership = typeof Ownership.Type

// QUERY

const queryFields = {
  q: Schema.Option(Schema.String),
  set: Schema.Array(SetCode),
  type: Schema.Array(CardType),
  supertype: Schema.Array(Supertype),
  domain: Schema.Array(Domain),
  rarity: Schema.Array(Rarity),
  variant: Schema.Array(Variant),
  keyword: Schema.Array(Schema.String),
  tag: Schema.Array(Schema.String),
  energy: Range,
  might: Range,
  power: Range,
  ownership: Ownership,
  sort: Schema.Option(Sort),
}

export const Query = Schema.Struct(queryFields)
export type Query = typeof Query.Type

export const empty: Query = {
  q: Option.none(),
  set: [],
  type: [],
  supertype: [],
  domain: [],
  rarity: [],
  variant: [],
  keyword: [],
  tag: [],
  energy: anyRange,
  might: anyRange,
  power: anyRange,
  ownership: 'All',
  sort: Option.none(),
}

export const activeFilterCount = (query: Query): number =>
  Array.length(query.set) +
  Array.length(query.type) +
  Array.length(query.supertype) +
  Array.length(query.domain) +
  Array.length(query.rarity) +
  Array.length(query.variant) +
  Array.length(query.keyword) +
  Array.length(query.tag) +
  Array.length(
    Array.filter(
      [query.energy, query.might, query.power],
      range => !isAnyRange(range),
    ),
  ) +
  (query.ownership === 'All' ? 0 : 1)

export const clearFilters = (query: Query): Query => ({
  ...empty,
  q: query.q,
  sort: query.sort,
})

export const toggle =
  <A>(value: A) =>
  (values: ReadonlyArray<A>): ReadonlyArray<A> =>
    Array.contains(values, value)
      ? Array.filter(values, existing => existing !== value)
      : Array.append(values, value)

export const effectiveSort = (query: Query): Sort =>
  Option.getOrElse(query.sort, () =>
    Option.isSome(query.q)
      ? { field: 'Relevance', direction: 'Descending' }
      : { field: 'Number', direction: 'Ascending' },
  )

// URL PARAMETERS

const LIST_SEPARATOR = ','
const RANGE_SEPARATOR = '-'
const SORT_SEPARATOR = '-'

const optionalParam = Schema.OptionFromOptional(Schema.String)

const termParam = optionalParam.pipe(
  Schema.decodeTo(
    Schema.Option(Schema.String),
    SchemaTransformation.transform({
      decode: (maybeRaw: Option.Option<string>): Option.Option<string> =>
        pipe(
          maybeRaw,
          Option.map(String.trim),
          Option.filter(String.isNonEmpty),
        ),
      encode: (maybeTerm: Option.Option<string>): Option.Option<string> =>
        maybeTerm,
    }),
  ),
)

const listParam = <A extends string>(item: Schema.Codec<A, string>) => {
  const decodeItem = Schema.decodeUnknownOption(item)

  return optionalParam.pipe(
    Schema.decodeTo(
      Schema.Array(item),
      SchemaTransformation.transform({
        decode: (maybeRaw: Option.Option<string>): ReadonlyArray<string> =>
          Option.match(maybeRaw, {
            onNone: () => [],
            onSome: raw =>
              pipe(
                String.split(LIST_SEPARATOR)(raw),
                Array.map(String.trim),
                Array.filter(value => Option.isSome(decodeItem(value))),
                Array.dedupe,
              ),
          }),
        encode: (values: ReadonlyArray<string>): Option.Option<string> =>
          Array.match(values, {
            onEmpty: () => Option.none(),
            onNonEmpty: nonEmpty =>
              Option.some(Array.join(nonEmpty, LIST_SEPARATOR)),
          }),
      }),
    ),
  )
}

const parseBound = (raw: string): Option.Option<Option.Option<number>> =>
  String.isEmpty(raw)
    ? Option.some(Option.none())
    : pipe(
        Number.parse(raw),
        Option.filter(
          bound => globalThis.Number.isInteger(bound) && bound >= 0,
        ),
        Option.map(Option.some),
      )

export const parseRange = (raw: string): Range =>
  pipe(
    String.split(RANGE_SEPARATOR)(raw),
    parts =>
      Array.length(parts) === 2
        ? Option.all({
            maybeMin: Option.flatMap(Array.get(parts, 0), parseBound),
            maybeMax: Option.flatMap(Array.get(parts, 1), parseBound),
          })
        : Option.none(),
    Option.filter(
      ({ maybeMin, maybeMax }) =>
        !Option.isSome(maybeMin) ||
        !Option.isSome(maybeMax) ||
        maybeMin.value <= maybeMax.value,
    ),
    Option.getOrElse(() => anyRange),
  )

export const formatRange = (range: Range): Option.Option<string> =>
  isAnyRange(range)
    ? Option.none()
    : Option.some(
        `${Option.getOrElse(range.maybeMin, () => '')}${RANGE_SEPARATOR}${Option.getOrElse(range.maybeMax, () => '')}`,
      )

const rangeParam = optionalParam.pipe(
  Schema.decodeTo(
    Range,
    SchemaTransformation.transform({
      decode: (maybeRaw: Option.Option<string>): Range =>
        Option.match(maybeRaw, { onNone: () => anyRange, onSome: parseRange }),
      encode: formatRange,
    }),
  ),
)

const SORT_FIELD_PARAMS: Readonly<Record<SortField, string>> = {
  Relevance: 'relevance',
  Name: 'name',
  Number: 'number',
  Energy: 'energy',
  Might: 'might',
  Power: 'power',
}

const SORT_DIRECTION_PARAMS: Readonly<Record<SortDirection, string>> = {
  Ascending: 'asc',
  Descending: 'desc',
}

const findKey = <K extends string>(
  record: Readonly<Record<K, string>>,
  value: string,
): Option.Option<K> =>
  Array.findFirst(
    Array.filter(Object.keys(record), (key): key is K => key in record),
    key => record[key] === value,
  )

export const parseSort = (raw: string): Option.Option<Sort> => {
  const parts = String.split(SORT_SEPARATOR)(raw)

  return Array.length(parts) === 2
    ? Option.all({
        field: Option.flatMap(Array.get(parts, 0), part =>
          findKey(SORT_FIELD_PARAMS, part),
        ),
        direction: Option.flatMap(Array.get(parts, 1), part =>
          findKey(SORT_DIRECTION_PARAMS, part),
        ),
      })
    : Option.none()
}

export const formatSort = (sort: Sort): string =>
  `${SORT_FIELD_PARAMS[sort.field]}${SORT_SEPARATOR}${SORT_DIRECTION_PARAMS[sort.direction]}`

const sortParam = optionalParam.pipe(
  Schema.decodeTo(
    Schema.Option(Sort),
    SchemaTransformation.transform({
      decode: (maybeRaw: Option.Option<string>): Option.Option<Sort> =>
        Option.flatMap(maybeRaw, parseSort),
      encode: (maybeSort: Option.Option<Sort>): Option.Option<string> =>
        Option.map(maybeSort, formatSort),
    }),
  ),
)

const OWNERSHIP_PARAMS: Readonly<Record<Ownership, string>> = {
  All: 'all',
  Owned: 'owned',
  NotOwned: 'not-owned',
}

const ownershipParam = optionalParam.pipe(
  Schema.decodeTo(
    Ownership,
    SchemaTransformation.transform({
      decode: (maybeRaw: Option.Option<string>): Ownership =>
        pipe(
          maybeRaw,
          Option.flatMap(raw => findKey(OWNERSHIP_PARAMS, raw)),
          Option.getOrElse((): Ownership => 'All'),
        ),
      encode: (ownership: Ownership): Option.Option<string> =>
        ownership === 'All'
          ? Option.none()
          : Option.some(OWNERSHIP_PARAMS[ownership]),
    }),
  ),
)

export const QueryParams = Schema.Struct({
  q: termParam,
  set: listParam(SetCode),
  type: listParam(CardType),
  supertype: listParam(Supertype),
  domain: listParam(Domain),
  rarity: listParam(Rarity),
  variant: listParam(Variant),
  keyword: listParam(Schema.String),
  tag: listParam(Schema.String),
  energy: rangeParam,
  might: rangeParam,
  power: rangeParam,
  ownership: ownershipParam,
  sort: sortParam,
})

// CHANGES

export const RangeField = Schema.Literals(['energy', 'might', 'power'])
export type RangeField = typeof RangeField.Type

export const Bound = Schema.Literals(['Min', 'Max'])
export type Bound = typeof Bound.Type

const withBoundOf = (
  range: Range,
  bound: Bound,
  value: Option.Option<number>,
): Range =>
  bound === 'Min'
    ? { maybeMin: value, maybeMax: range.maybeMax }
    : { maybeMin: range.maybeMin, maybeMax: value }

export const withBound = (
  query: Query,
  field: RangeField,
  bound: Bound,
  value: Option.Option<number>,
): Query =>
  Match.value(field).pipe(
    Match.withReturnType<Query>(),
    Match.when('energy', () => ({
      ...query,
      energy: withBoundOf(query.energy, bound, value),
    })),
    Match.when('might', () => ({
      ...query,
      might: withBoundOf(query.might, bound, value),
    })),
    Match.when('power', () => ({
      ...query,
      power: withBoundOf(query.power, bound, value),
    })),
    Match.exhaustive,
  )

const toggleDecoded = <A extends string>(
  schema: Schema.Codec<A, string>,
  values: ReadonlyArray<A>,
  value: string,
): ReadonlyArray<A> =>
  Option.match(Schema.decodeOption(schema)(value), {
    onNone: () => values,
    onSome: decoded => toggle(decoded)(values),
  })

export const toggleFacet = (
  query: Query,
  facet: FacetName,
  value: string,
): Query =>
  Match.value(facet).pipe(
    Match.withReturnType<Query>(),
    Match.when('set', () => ({
      ...query,
      set: toggleDecoded(SetCode, query.set, value),
    })),
    Match.when('type', () => ({
      ...query,
      type: toggleDecoded(CardType, query.type, value),
    })),
    Match.when('supertype', () => ({
      ...query,
      supertype: toggleDecoded(Supertype, query.supertype, value),
    })),
    Match.when('domain', () => ({
      ...query,
      domain: toggleDecoded(Domain, query.domain, value),
    })),
    Match.when('rarity', () => ({
      ...query,
      rarity: toggleDecoded(Rarity, query.rarity, value),
    })),
    Match.when('variant', () => ({
      ...query,
      variant: toggleDecoded(Variant, query.variant, value),
    })),
    Match.when('keyword', () => ({
      ...query,
      keyword: toggleDecoded(Schema.String, query.keyword, value),
    })),
    Match.when('tag', () => ({
      ...query,
      tag: toggleDecoded(Schema.String, query.tag, value),
    })),
    Match.exhaustive,
  )

export const selectedValues = (
  query: Query,
  facet: FacetName,
): ReadonlyArray<string> => query[facet]

export const parseOwnership = (raw: string): Ownership =>
  Option.getOrElse(
    Schema.decodeUnknownOption(Ownership)(raw),
    (): Ownership => 'All',
  )

export const withTerm = (query: Query, text: string): Query => ({
  ...query,
  q: pipe(Option.some(String.trim(text)), Option.filter(String.isNonEmpty)),
})

export const SORT_CHOICES: ReadonlyArray<Sort> = [
  { field: 'Relevance', direction: 'Descending' },
  { field: 'Number', direction: 'Ascending' },
  { field: 'Name', direction: 'Ascending' },
  { field: 'Name', direction: 'Descending' },
  { field: 'Energy', direction: 'Ascending' },
  { field: 'Energy', direction: 'Descending' },
  { field: 'Might', direction: 'Ascending' },
  { field: 'Might', direction: 'Descending' },
  { field: 'Power', direction: 'Ascending' },
  { field: 'Power', direction: 'Descending' },
]

export const isSameQuery = Schema.toEquivalence(Query)
