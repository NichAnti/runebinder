import { Arbitrary, Array, Option, Schema } from 'effect'
import { describe, expect, test } from 'vitest'

import { prop } from '@effect/vitest'

import * as CatalogueQuery from './catalogueQuery'

const decode = Schema.decodeUnknownSync(CatalogueQuery.QueryParams)
const encode = Schema.encodeSync(CatalogueQuery.QueryParams)

const RawParams = Schema.Struct({
  q: Schema.optionalKey(Schema.String),
  set: Schema.optionalKey(Schema.String),
  type: Schema.optionalKey(Schema.String),
  domain: Schema.optionalKey(Schema.String),
  keyword: Schema.optionalKey(Schema.String),
  energy: Schema.optionalKey(Schema.String),
  ownership: Schema.optionalKey(Schema.String),
  sort: Schema.optionalKey(Schema.String),
})

const listOf = <A>(values: Schema.Schema<A>) =>
  Arbitrary.array(Arbitrary.schema(values)).pipe(Arbitrary.map(Array.dedupe))

const bound = Arbitrary.schema(Schema.Option(Schema.Literals([0, 1, 2, 5, 12])))

const range = Arbitrary.all({ maybeMin: bound, maybeMax: bound }).pipe(
  Arbitrary.filter(
    ({ maybeMin, maybeMax }) =>
      !Option.isSome(maybeMin) ||
      !Option.isSome(maybeMax) ||
      maybeMin.value <= maybeMax.value,
  ),
)

const canonicalQuery = Arbitrary.all({
  q: Arbitrary.schema(
    Schema.Option(Schema.Literals(['vi', 'piltover enforcer', 'rune'])),
  ),
  set: listOf(Schema.Literals(['UNL', 'OGN', 'SFD'])),
  type: listOf(Schema.Literals(['Unit', 'Spell', 'Legend'])),
  supertype: listOf(Schema.Literals(['Champion', 'Token'])),
  domain: listOf(Schema.Literals(['Fury', 'Calm', 'Colorless'])),
  rarity: listOf(Schema.Literals(['Common', 'Epic'])),
  variant: listOf(Schema.Literals(['Base', 'AlternateArt', 'Signature'])),
  keyword: listOf(Schema.Literals(['Tank', 'Assault', 'Deflect'])),
  tag: listOf(Schema.Literals(['Vi', 'Piltover', "Kai'Sa"])),
  energy: range,
  might: range,
  power: range,
  ownership: Arbitrary.schema(CatalogueQuery.Ownership),
  sort: Arbitrary.schema(Schema.Option(CatalogueQuery.Sort)),
})

describe('QueryParams', () => {
  test('decodes a full query', () => {
    expect(
      decode({
        q: '  vi ',
        set: 'UNL,OGN,UNL,nope',
        domain: 'Fury,Purple',
        keyword: 'Tank,Assault',
        energy: '2-5',
        might: '-3',
        power: '1-',
        ownership: 'wanted',
        sort: 'energy-desc',
      }),
    ).toStrictEqual({
      ...CatalogueQuery.empty,
      q: Option.some('vi'),
      set: ['UNL', 'OGN'],
      domain: ['Fury'],
      keyword: ['Tank', 'Assault'],
      energy: { maybeMin: Option.some(2), maybeMax: Option.some(5) },
      might: { maybeMin: Option.none(), maybeMax: Option.some(3) },
      power: { maybeMin: Option.some(1), maybeMax: Option.none() },
      ownership: 'Wanted',
      sort: Option.some({ field: 'Energy', direction: 'Descending' }),
    })
  })

  test('invalid values are dropped instead of failing', () => {
    expect(
      decode({
        energy: '5-2',
        might: 'lots',
        sort: 'sideways',
        q: '   ',
        ownership: 'mine',
      }),
    ).toStrictEqual(CatalogueQuery.empty)
  })

  test('an empty query encodes to no parameters', () => {
    expect(encode(CatalogueQuery.empty)).toStrictEqual({})
  })

  prop(
    'every canonical query survives encoding and decoding',
    { query: canonicalQuery },
    ({ query }) => {
      const encoded = encode(Schema.decodeSync(CatalogueQuery.Query)(query))
      expect(encode(decode(encoded))).toStrictEqual(encoded)
    },
  )

  prop(
    'decoding is stable: decode(encode(decode(params))) equals decode(params)',
    { params: RawParams },
    ({ params }) => {
      const encoded = encode(decode(params))
      expect(encode(decode(encoded))).toStrictEqual(encoded)
    },
  )
})

describe('activeFilterCount and clearFilters', () => {
  const query = decode({
    q: 'vi',
    set: 'UNL,OGN',
    energy: '2-',
    ownership: 'owned',
    sort: 'name-asc',
  })

  test('counts each filter value and each bounded range, not the view', () => {
    expect(CatalogueQuery.activeFilterCount(query)).toBe(3)
  })

  test('clearing filters keeps the search, the view and the sort', () => {
    expect(CatalogueQuery.clearFilters(query)).toStrictEqual({
      ...CatalogueQuery.empty,
      q: Option.some('vi'),
      ownership: 'Owned',
      sort: Option.some({ field: 'Name', direction: 'Ascending' }),
    })
  })
})

describe('effectiveSort', () => {
  test('relevance while searching, collector number otherwise', () => {
    expect(
      CatalogueQuery.effectiveSort({
        ...CatalogueQuery.empty,
        q: Option.some('vi'),
      }),
    ).toStrictEqual({ field: 'Relevance', direction: 'Descending' })
    expect(CatalogueQuery.effectiveSort(CatalogueQuery.empty)).toStrictEqual({
      field: 'Number',
      direction: 'Ascending',
    })
  })
})

describe('toggle', () => {
  test('adds a missing value and removes a present one', () => {
    expect(CatalogueQuery.toggle('Fury')(['Calm'])).toStrictEqual([
      'Calm',
      'Fury',
    ])
    expect(CatalogueQuery.toggle('Fury')(['Calm', 'Fury'])).toStrictEqual([
      'Calm',
    ])
  })
})
