import { Effect, Layer, Option } from 'effect'
import { HttpServer } from 'effect/http'
import { HttpApiTest } from 'effect/http-api'

import { assert, layer } from '@effect/vitest'

import { Api, Authentication, CurrentUser } from '../../api'
import { Collection, Printing, User, Wishlist } from '../../domain'
import { PrintingCatalogue } from '../catalogue/printingCatalogue'
import { WishlistLive } from './http'
import { WishlistRepository } from './repository'

const ada = User.User.make({
  id: User.UserId.make('user-ada'),
  name: 'Ada',
  email: 'ada@example.com',
})
const vi = Printing.PrintingId.make('ogn-066-298')

const SignedInAs = (user: User.User) =>
  Layer.succeed(Authentication, httpEffect =>
    Effect.provideService(httpEffect, CurrentUser, user),
  )

const makeClient = HttpApiTest.groups(Api, ['wishlist'])
const sent = (value: number) => Wishlist.CardTraderWishlistId.make(value)

layer(
  Layer.mergeAll(
    WishlistLive.pipe(
      Layer.provide(WishlistRepository.layerMemory),
      Layer.provide(PrintingCatalogue.layerFrom({ [vi]: 'Unit' })),
      Layer.provideMerge(SignedInAs(ada)),
    ),
    HttpServer.layerServices,
  ),
)('wishlist api', it => {
  it.effect('cards added by hand are listed', () =>
    Effect.gen(function* () {
      const client = yield* makeClient

      yield* client.wishlist.setItem({
        params: { printingId: vi },
        payload: { quantity: Collection.Quantity.make(2) },
      })

      assert.deepStrictEqual(yield* client.wishlist.show(), {
        items: [{ printingId: vi, quantity: Collection.OwnedQuantity.make(2) }],
        maybeCardTraderWishlistId: Option.none(),
      })
    }),
  )

  it.effect('a new CardTrader wishlist returns the one it replaces', () =>
    Effect.gen(function* () {
      const client = yield* makeClient

      const first = yield* client.wishlist.replaceCardTraderWishlist({
        payload: { wishlistId: sent(100) },
      })
      const second = yield* client.wishlist.replaceCardTraderWishlist({
        payload: { wishlistId: sent(101) },
      })

      assert.deepStrictEqual(first.maybePreviousWishlistId, Option.none())
      assert.deepStrictEqual(
        second.maybePreviousWishlistId,
        Option.some(sent(100)),
      )
    }),
  )

  it.effect('a printing that is not in the catalogue is rejected', () =>
    Effect.gen(function* () {
      const client = yield* makeClient
      const error = yield* client.wishlist
        .setItem({
          params: { printingId: Printing.PrintingId.make('ogn-999-298') },
          payload: { quantity: Collection.Quantity.make(1) },
        })
        .pipe(Effect.flip)

      assert.strictEqual(error._tag, 'UnknownPrinting')
    }),
  )
})
