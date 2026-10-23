import { Schema } from 'effect'
import { HttpApiEndpoint, HttpApiGroup } from 'effect/http-api'

import { Deck, DeckStructure } from '../domain'
import { Authentication } from './authentication'

export class DeckNotFound extends Schema.TaggedError<DeckNotFound>()(
  'DeckNotFound',
  { deckId: Deck.DeckId },
  { httpApiStatus: 404 },
) {}

export class MalformedDeck extends Schema.TaggedError<MalformedDeck>()(
  'MalformedDeck',
  { problems: Schema.NonEmptyArray(DeckStructure.StructureProblem) },
  { httpApiStatus: 400 },
) {}

export const DeckInput = Schema.Struct({
  name: Deck.DeckName,
  contents: Deck.DeckContents,
})
export type DeckInput = typeof DeckInput.Type

const deckIdParams = { deckId: Deck.DeckId }

export class Decks extends HttpApiGroup.make('decks')
  .add(
    HttpApiEndpoint.get('list', '/api/decks', {
      success: Schema.Array(Deck.Deck),
    }),
    HttpApiEndpoint.post('create', '/api/decks', {
      payload: DeckInput,
      success: Deck.Deck,
      error: MalformedDeck,
    }),
    HttpApiEndpoint.put('replace', '/api/decks/:deckId', {
      params: deckIdParams,
      payload: DeckInput,
      error: [DeckNotFound, MalformedDeck],
    }),
    HttpApiEndpoint.delete('remove', '/api/decks/:deckId', {
      params: deckIdParams,
      error: DeckNotFound,
    }),
  )
  .middleware(Authentication) {}
