import { Array, Effect } from 'effect'
import { HttpApiBuilder } from 'effect/http-api'

import { Api, CurrentUser, type DeckInput, MalformedDeck } from '../../api'
import { DeckStructure } from '../../domain'
import { PrintingCatalogue } from '../catalogue/printingCatalogue'
import { DeckRepository } from './repository'

export const DecksLive = HttpApiBuilder.group(
  Api,
  'decks',
  Effect.fn(function* (handlers) {
    const repository = yield* DeckRepository
    const catalogue = yield* PrintingCatalogue

    const wellFormed = (input: DeckInput) =>
      Effect.flatMap(catalogue.index, ({ find }) =>
        Array.match(DeckStructure.structureProblems(input.contents, find), {
          onEmpty: () => Effect.succeed(input),
          onNonEmpty: problems => Effect.fail(new MalformedDeck({ problems })),
        }),
      )

    return handlers.handleAll({
      list: () =>
        Effect.gen(function* () {
          const user = yield* CurrentUser
          return yield* repository.list(user.id)
        }),
      create: ({ payload }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser
          const input = yield* wellFormed(payload)
          return yield* repository.create(user.id, input)
        }),
      replace: ({ params: { deckId }, payload }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser
          const input = yield* wellFormed(payload)
          yield* repository.replace(user.id, deckId, input)
        }),
      remove: ({ params: { deckId } }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser
          yield* repository.remove(user.id, deckId)
        }),
    })
  }),
)
