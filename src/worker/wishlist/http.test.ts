import { Effect, Layer } from 'effect'
import { HttpServer } from 'effect/http'
import { HttpApiTest } from 'effect/http-api'

import { assert, layer } from '@effect/vitest'

import { Api, Authentication, CurrentUser } from '../../api'
import { Collection, Deck, Printing, User, Wishlist } from '../../domain'
import { PrintingCatalogue } from '../catalogue/printingCatalogue'
import { WishlistLive } from './http'
import { WishlistRepository } from './repository'

const ada = User.User.make({
  id: User.UserId.make('user-ada'),
  name: 'Ada',
  email: 'ada@example.com',
})
const vi = Printing.PrintingId.make('ogn-066-298')
const adasDeck = Deck.DeckId.make('7a1e5f8e-3c1b-4a8e-9d2f-0b6c4e2a9f10')
const othersDeck = Deck.DeckId.make('2b9c7d4e-8f1a-4c3b-a5e6-d7f8091a2b3c')

const SignedInAs = (user: User.User) =>
  Layer.succeed(Authentication, httpEffect =>
    Effect.provideService(httpEffect, CurrentUser, user),
  )

const makeClient = HttpApiTest.groups(Api, ['wishlist'])
const sent = (value: number) => Wishlist.CardTraderWishlistId.make(value)

layer(
  Layer.mergeAll(
    WishlistLive.pipe(
      Layer.provide(WishlistRepository.layerMemoryWith([[ada.id, adasDeck]])),
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
        cardTraderLinks: [],
      })
    }),
  )

  it.effect('each wishlist keeps its own CardTrader link', () =>
    Effect.gen(function* () {
      const client = yield* makeClient

      yield* client.wishlist.linkCustom({
        payload: { cardTraderWishlistId: sent(100) },
      })
      yield* client.wishlist.linkCustom({
        payload: { cardTraderWishlistId: sent(101) },
      })
      yield* client.wishlist.linkDeck({
        params: { deckId: adasDeck },
        payload: { cardTraderWishlistId: sent(200) },
      })

      assert.deepStrictEqual((yield* client.wishlist.show()).cardTraderLinks, [
        { wishlist: Wishlist.CUSTOM, cardTraderWishlistId: sent(101) },
        {
          wishlist: Wishlist.deckWishlist(adasDeck),
          cardTraderWishlistId: sent(200),
        },
      ])

      yield* client.wishlist.unlinkCustom()
      yield* client.wishlist.unlinkDeck({ params: { deckId: adasDeck } })

      assert.deepStrictEqual(
        (yield* client.wishlist.show()).cardTraderLinks,
        [],
      )
    }),
  )

  it.effect("another user's deck cannot be linked", () =>
    Effect.gen(function* () {
      const client = yield* makeClient
      const error = yield* client.wishlist
        .linkDeck({
          params: { deckId: othersDeck },
          payload: { cardTraderWishlistId: sent(300) },
        })
        .pipe(Effect.flip)

      assert.strictEqual(error._tag, 'DeckNotFound')
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
