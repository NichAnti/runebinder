import { Schema } from 'effect'
import { defineMessageUnion } from 'foldkit/message'

import { Deck, DeckCode, Printing } from '../../../../domain'
import { Dialog, Toast } from '../../../../ui'

export const Message = defineMessageUnion({
  SucceededLoadDeckListCards: { cards: Schema.Array(Printing.Card) },
  SkippedLoadDeckListCards: {},
  ClickedNewDeck: {},
  ClickedImportCode: {},
  GotNewDeckDialogMessage: { message: Dialog.Message },
  GotImportDialogMessage: { message: Dialog.Message },
  ClickedCopyCode: { deckId: Deck.DeckId },
  CompletedCopyDeckCode: { code: DeckCode.DeckCode },
  FailedCopyDeckCode: { code: DeckCode.DeckCode },
  ClickedDuplicate: { deckId: Deck.DeckId },
  ClickedDelete: { deckId: Deck.DeckId },
  ClickedConfirmDelete: {},
  GotDeleteDialogMessage: { message: Dialog.Message },
  GotToastMessage: { message: Toast.Notification.Message },
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
  RequestedRemoveDeck: { deckId: Deck.DeckId },
  RequestedRetryLoadDecks: {},
})
export type OutMessage = typeof OutMessage.Type
