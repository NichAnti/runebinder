import { Effect, Layer, Option } from 'effect'
import { HttpServer } from 'effect/http'
import { HttpApiTest } from 'effect/http-api'

import { BrowserCrypto } from '@effect/platform-browser'
import { assert, layer } from '@effect/vitest'

import { Api, Authentication, CurrentUser } from '../../api'
import { Deck, Printing, User } from '../../domain'
import { PrintingCatalogue } from '../catalogue/printingCatalogue'
import { DecksLive } from './http'
import { DeckRepository } from './repository'

const ada = User.User.make({
  id: User.UserId.make('user-ada'),
  name: 'Ada',
  email: 'ada@example.com',
})
const grace = User.UserId.make('user-grace')

const legend = Printing.PrintingId.make('ogn-261-298')
const vi = Printing.PrintingId.make('ogn-103-298')
const rune = Printing.PrintingId.make('ogn-007-298')

const SignedInAs = (user: User.User) =>
  Layer.succeed(Authentication, httpEffect =>
    Effect.provideService(httpEffect, CurrentUser, user),
  )

const Repository = DeckRepository.layerMemory.pipe(
  Layer.provide(BrowserCrypto.layer),
)

const makeClient = HttpApiTest.groups(Api, ['decks'])

const name = Deck.DeckName.make('Vi aggro')
const contents: Deck.DeckContents = {
  ...Deck.empty,
  maybeLegend: Option.some(legend),
  main: [{ printingId: vi, copies: Deck.Copies.make(3) }],
  runes: [{ printingId: rune, copies: Deck.Copies.make(12) }],
}

layer(
  Layer.mergeAll(
    DecksLive.pipe(
      Layer.provide(Repository),
      Layer.provide(
        PrintingCatalogue.layerFrom({
          [legend]: 'Legend',
          [vi]: 'Unit',
          [rune]: 'Rune',
        }),
      ),
      Layer.provideMerge(SignedInAs(ada)),
    ),
    HttpServer.layerServices,
  ),
)('decks api', it => {
  it.effect('a deck is created, listed, replaced and removed', () =>
    Effect.gen(function* () {
      const client = yield* makeClient

      const created = yield* client.decks.create({
        payload: { name, contents },
      })
      assert.deepStrictEqual(yield* client.decks.list(), [created])

      const renamed = Deck.DeckName.make('Vi tempo')
      yield* client.decks.replace({
        params: { deckId: created.id },
        payload: { name: renamed, contents: Deck.empty },
      })
      assert.deepStrictEqual(yield* client.decks.list(), [
        { id: created.id, name: renamed, contents: Deck.empty },
      ])

      yield* client.decks.remove({ params: { deckId: created.id } })
      assert.deepStrictEqual(yield* client.decks.list(), [])
    }),
  )

  it.effect('a card in the wrong part is rejected with where it is', () =>
    Effect.gen(function* () {
      const client = yield* makeClient
      const error = yield* client.decks
        .create({
          payload: {
            name,
            contents: {
              ...Deck.empty,
              main: [{ printingId: rune, copies: Deck.Copies.make(1) }],
            },
          },
        })
        .pipe(Effect.flip)

      assert.deepStrictEqual(error._tag, 'MalformedDeck')
      assert.deepStrictEqual(
        error._tag === 'MalformedDeck' ? error.problems : [],
        [{ _tag: 'WrongCardType', place: 'Main', printingId: rune }],
      )
    }),
  )

  it.effect('an unknown deck is not found', () =>
    Effect.gen(function* () {
      const client = yield* makeClient
      const deckId = Deck.DeckId.make('7b0f2a7e-2a9c-4c6e-9d2b-6a6f1c9d2e11')
      const error = yield* client.decks
        .remove({ params: { deckId } })
        .pipe(Effect.flip)

      assert.strictEqual(error._tag, 'DeckNotFound')
    }),
  )
})

layer(Repository)('deck repository', it => {
  it.effect('keeps each user’s decks separate', () =>
    Effect.gen(function* () {
      const repository = yield* DeckRepository
      const created = yield* repository.create(ada.id, { name, contents })

      assert.deepStrictEqual(yield* repository.list(grace), [])
      const error = yield* repository
        .replace(grace, created.id, { name, contents })
        .pipe(Effect.flip)
      assert.strictEqual(error._tag, 'DeckNotFound')
    }),
  )
})
