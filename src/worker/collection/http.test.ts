import { Effect, Layer } from 'effect'
import { HttpServer } from 'effect/http'
import { HttpApiTest } from 'effect/http-api'

import { assert, layer } from '@effect/vitest'

import { Api, Authentication, CurrentUser } from '../../api'
import { Collection, Printing, User } from '../../domain'
import { PrintingCatalogue } from '../catalogue/printingCatalogue'
import { CollectionLive } from './http'
import { CollectionRepository } from './repository'

const ada = User.User.make({
  id: User.UserId.make('user-ada'),
  name: 'Ada',
  email: 'ada@example.com',
})
const grace = User.User.make({
  id: User.UserId.make('user-grace'),
  name: 'Grace',
  email: 'grace@example.com',
})

const vi = Printing.PrintingId.make('ogn-066-298')
const viAlternateArt = Printing.PrintingId.make('ogn-066a-298')
const unknown = Printing.PrintingId.make('ogn-999-298')

const SignedInAs = (user: User.User) =>
  Layer.succeed(Authentication, httpEffect =>
    Effect.provideService(httpEffect, CurrentUser, user),
  )

const makeClient = HttpApiTest.groups(Api, ['collection'])

const handlersFor = (user: User.User) =>
  CollectionLive.pipe(
    Layer.provide(
      PrintingCatalogue.layerFrom({ [vi]: 'Unit', [viAlternateArt]: 'Unit' }),
    ),
    Layer.provideMerge(SignedInAs(user)),
  )

const quantity = (value: number) => ({
  payload: { quantity: Collection.Quantity.make(value) },
})

layer(
  Layer.mergeAll(
    handlersFor(ada).pipe(Layer.provide(CollectionRepository.layerMemory)),
    HttpServer.layerServices,
  ),
)('collection api', it => {
  it.effect('a set quantity is listed, and zero removes it', () =>
    Effect.gen(function* () {
      const client = yield* makeClient

      yield* client.collection.set({
        params: { printingId: vi },
        ...quantity(2),
      })
      yield* client.collection.set({
        params: { printingId: viAlternateArt },
        ...quantity(1),
      })
      yield* client.collection.set({
        params: { printingId: vi },
        ...quantity(3),
      })
      assert.sameDeepMembers(
        [...(yield* client.collection.list())],
        [
          { printingId: vi, quantity: Collection.OwnedQuantity.make(3) },
          {
            printingId: viAlternateArt,
            quantity: Collection.OwnedQuantity.make(1),
          },
        ],
      )

      yield* client.collection.set({
        params: { printingId: vi },
        ...quantity(0),
      })
      assert.deepStrictEqual(
        [...(yield* client.collection.list())],
        [
          {
            printingId: viAlternateArt,
            quantity: Collection.OwnedQuantity.make(1),
          },
        ],
      )
    }),
  )

  it.effect('a printing that is not in the catalogue is rejected', () =>
    Effect.gen(function* () {
      const client = yield* makeClient
      const error = yield* client.collection
        .set({ params: { printingId: unknown }, ...quantity(1) })
        .pipe(Effect.flip)

      assert.strictEqual(error._tag, 'UnknownPrinting')
    }),
  )
})

layer(CollectionRepository.layerMemory)('collection repository', it => {
  it.effect('keeps each user’s collection separate', () =>
    Effect.gen(function* () {
      const repository = yield* CollectionRepository

      yield* repository.set(ada.id, vi, Collection.Quantity.make(2))

      assert.deepStrictEqual(yield* repository.list(grace.id), [])
      assert.deepStrictEqual(yield* repository.list(ada.id), [
        { printingId: vi, quantity: Collection.OwnedQuantity.make(2) },
      ])
    }),
  )
})
