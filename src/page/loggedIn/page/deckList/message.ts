import { Schema } from 'effect'
import { defineMessageUnion } from 'foldkit/message'

import { Deck, DeckCode } from '../../../../domain'

export const Message = defineMessageUnion({
  UpdatedNewName: { value: Schema.String },
  SubmittedNewDeck: {},
  UpdatedImportName: { value: Schema.String },
  UpdatedImportCode: { value: Schema.String },
  SubmittedImport: {},
  SucceededReadDeckCode: { name: Deck.DeckName, contents: Deck.DeckContents },
  FailedReadDeckCode: { problem: DeckCode.DeckCodeProblem },
  SkippedReadDeckCode: {},
  ClickedRetryLoadDecks: {},
})
export type Message = typeof Message.Type

export const OutMessage = defineMessageUnion({
  RequestedCreateDeck: { name: Deck.DeckName, contents: Deck.DeckContents },
  RequestedRetryLoadDecks: {},
})
export type OutMessage = typeof OutMessage.Type
