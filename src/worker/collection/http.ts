import { Effect } from 'effect'
import { HttpApiBuilder } from 'effect/http-api'

import { Api, CurrentUser, UnknownPrinting } from '../../api'
import { PrintingCatalogue } from '../catalogue/printingCatalogue'
import { CollectionRepository } from './repository'

export const CollectionLive = HttpApiBuilder.group(
  Api,
  'collection',
  Effect.fn(function* (handlers) {
    const repository = yield* CollectionRepository
    const catalogue = yield* PrintingCatalogue

    return handlers.handleAll({
      list: () =>
        Effect.gen(function* () {
          const user = yield* CurrentUser
          return yield* repository.list(user.id)
        }),
      set: ({ params: { printingId }, payload: { quantity } }) =>
        Effect.gen(function* () {
          if (!catalogue.has(printingId)) {
            return yield* new UnknownPrinting({ printingId })
          }

          const user = yield* CurrentUser
          yield* repository.set(user.id, printingId, quantity)
        }),
    })
  }),
)
