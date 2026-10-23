import { Effect } from 'effect'
import { HttpApiBuilder } from 'effect/http-api'

import { Api, CurrentUser, UnknownPrinting } from '../../api'
import { PrintingCatalogue } from '../catalogue/printingCatalogue'
import { WishlistRepository } from './repository'

export const WishlistLive = HttpApiBuilder.group(
  Api,
  'wishlist',
  Effect.fn(function* (handlers) {
    const repository = yield* WishlistRepository
    const catalogue = yield* PrintingCatalogue

    return handlers.handleAll({
      show: () =>
        Effect.gen(function* () {
          const user = yield* CurrentUser
          return yield* repository.show(user.id)
        }),
      setItem: ({ params: { printingId }, payload: { quantity } }) =>
        Effect.gen(function* () {
          if (!catalogue.has(printingId)) {
            return yield* new UnknownPrinting({ printingId })
          }

          const user = yield* CurrentUser
          yield* repository.setItem(user.id, printingId, quantity)
        }),
      linkCustom: ({ payload: { cardTraderWishlistId } }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser
          yield* repository.linkCustom(user.id, cardTraderWishlistId)
        }),
      unlinkCustom: () =>
        Effect.gen(function* () {
          const user = yield* CurrentUser
          yield* repository.unlinkCustom(user.id)
        }),
      linkDeck: ({ params: { deckId }, payload: { cardTraderWishlistId } }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser
          yield* repository.linkDeck(user.id, deckId, cardTraderWishlistId)
        }),
      unlinkDeck: ({ params: { deckId } }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser
          yield* repository.unlinkDeck(user.id, deckId)
        }),
    })
  }),
)
