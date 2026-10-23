import { Array, Effect, FileSystem, Option, Schema } from 'effect'

import { NodeServices } from '@effect/platform-node'
import { assert, layer } from '@effect/vitest'

import { Catalogue, CatalogueQuery, Printing } from '../domain'
import * as CatalogueIndex from './catalogueIndex'

const LIMIT = 2000

const loadIndex = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem
  const catalogue = yield* fs
    .readFileString('catalogue/catalogue.json')
    .pipe(Effect.flatMap(Schema.decodeEffect(Catalogue.CatalogueJson)))
  return yield* CatalogueIndex.build(catalogue.printings)
})

const query = (
  changes: Partial<CatalogueQuery.Query>,
): CatalogueQuery.Query => ({ ...CatalogueQuery.empty, ...changes })

const cardOf = (index: CatalogueIndex.CatalogueIndex, id: string) =>
  Option.getOrThrow(CatalogueIndex.cardById(index, Printing.CardId.make(id)))

layer(NodeServices.layer)('the catalogue index', it => {
  it.effect('an empty query returns every card', () =>
    Effect.gen(function* () {
      const index = yield* loadIndex
      const result = yield* CatalogueIndex.searchCards(
        index,
        CatalogueQuery.empty,
        LIMIT,
        [],
      )
      assert.strictEqual(result.total, index.cards.size)
      assert.strictEqual(Array.length(result.cards), index.cards.size)
    }),
  )

  it.effect('finds cards by name and tolerates a typo', () =>
    Effect.gen(function* () {
      const index = yield* loadIndex
      const exact = yield* CatalogueIndex.searchCards(
        index,
        query({ q: Option.some('piltover') }),
        LIMIT,
        [],
      )
      const typo = yield* CatalogueIndex.searchCards(
        index,
        query({ q: Option.some('piltovr') }),
        LIMIT,
        [],
      )

      assert.isTrue(exact.total > 0)
      assert.deepStrictEqual(
        Array.map(typo.cards, ({ id }) => id),
        Array.map(exact.cards, ({ id }) => id),
      )
    }),
  )

  it.effect('the ownership filter keeps owned or not owned cards', () =>
    Effect.gen(function* () {
      const index = yield* loadIndex
      const vi = cardOf(index, 'vi-destructive')
      const ownedPrintingIds = Array.map(vi.printings, ({ id }) => id)

      const owned = yield* CatalogueIndex.searchCards(
        index,
        query({ ownership: 'Owned' }),
        LIMIT,
        ownedPrintingIds,
      )
      const notOwned = yield* CatalogueIndex.searchCards(
        index,
        query({ ownership: 'NotOwned' }),
        LIMIT,
        ownedPrintingIds,
      )
      const nothingOwned = yield* CatalogueIndex.searchCards(
        index,
        query({ ownership: 'Owned' }),
        LIMIT,
        [],
      )

      assert.deepStrictEqual(
        Array.map(owned.cards, ({ id }) => id),
        [vi.id],
      )
      assert.strictEqual(notOwned.total, index.cards.size - 1)
      assert.strictEqual(nothingOwned.total, 0)
    }),
  )

  it.effect('a domain filter keeps only cards of that domain', () =>
    Effect.gen(function* () {
      const index = yield* loadIndex
      const result = yield* CatalogueIndex.searchCards(
        index,
        query({ domain: ['Fury'] }),
        LIMIT,
        [],
      )

      assert.isTrue(result.total > 0)
      assert.isTrue(
        Array.every(result.cards, ({ domains }) =>
          Array.contains(domains, 'Fury'),
        ),
      )
    }),
  )

  it.effect(
    'filter counts within a group ignore that group’s own selection',
    () =>
      Effect.gen(function* () {
        const index = yield* loadIndex
        const result = yield* CatalogueIndex.searchCards(
          index,
          query({ domain: ['Fury'] }),
          LIMIT,
          [],
        )
        const calm = Array.findFirst(
          result.facets.domain,
          ({ value }) => value === 'Calm',
        )

        assert.isTrue(Option.exists(calm, ({ count }) => count > 0))
      }),
  )

  it.effect('an energy range keeps cards within it', () =>
    Effect.gen(function* () {
      const index = yield* loadIndex
      const result = yield* CatalogueIndex.searchCards(
        index,
        query({
          energy: { maybeMin: Option.some(2), maybeMax: Option.some(3) },
        }),
        LIMIT,
        [],
      )

      assert.isTrue(result.total > 0)
      assert.isTrue(
        Array.every(result.cards, ({ id }) => {
          const energy = Printing.basePrinting(cardOf(index, id)).maybeEnergy
          return Option.exists(energy, value => value >= 2 && value <= 3)
        }),
      )
    }),
  )

  it.effect('sorting by energy orders the results', () =>
    Effect.gen(function* () {
      const index = yield* loadIndex
      const result = yield* CatalogueIndex.searchCards(
        index,
        query({
          energy: { maybeMin: Option.some(0), maybeMax: Option.none() },
          sort: Option.some({ field: 'Energy', direction: 'Ascending' }),
        }),
        LIMIT,
        [],
      )
      const energies = Array.getSomes(
        Array.map(
          result.cards,
          ({ id }) => Printing.basePrinting(cardOf(index, id)).maybeEnergy,
        ),
      )

      assert.deepStrictEqual(
        energies,
        Array.sort(energies, (a: number, b: number) =>
          a < b ? -1 : a > b ? 1 : 0,
        ),
      )
    }),
  )

  it.effect('every catalogue-wide filter group has values', () =>
    Effect.gen(function* () {
      const index = yield* loadIndex
      assert.isTrue(
        Array.every(
          Object.values(index.allValues),
          Array.isReadonlyArrayNonEmpty,
        ),
      )
    }),
  )
})
