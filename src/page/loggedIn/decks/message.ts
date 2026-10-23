import { Schema } from 'effect'
import { defineMessageUnion } from 'foldkit/message'

import { Deck } from '../../../domain'

export const Message = defineMessageUnion({
  SucceededLoadDecks: { decks: Schema.Array(Deck.Deck) },
  FailedLoadDecks: {},
  ClickedRetryLoadDecks: {},
  SucceededCreateDeck: { deck: Deck.Deck },
  FailedCreateDeck: {},
  ElapsedSaveDeckDelay: { deckId: Deck.DeckId, revision: Schema.Int },
  SucceededSaveDeck: { deckId: Deck.DeckId, revision: Schema.Int },
  FailedSaveDeck: { deckId: Deck.DeckId, revision: Schema.Int },
  ClickedRetryDeckSaves: {},
  SucceededRemoveDeck: { deckId: Deck.DeckId },
  FailedRemoveDeck: { deckId: Deck.DeckId },
})
export type Message = typeof Message.Type

export const OutMessage = defineMessageUnion({
  CreatedDeck: { deckId: Deck.DeckId },
  RemovedDeck: { deckId: Deck.DeckId },
})
export type OutMessage = typeof OutMessage.Type
