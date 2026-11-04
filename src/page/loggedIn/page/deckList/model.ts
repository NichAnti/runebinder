import { Option, Schema } from 'effect'
import { Field, NotValidated } from 'foldkit/fieldValidation'
import { defineTaggedUnion } from 'foldkit/schema'

import { Deck, DeckCode, Printing } from '../../../../domain'
import { Dialog, Toast } from '../../../../ui'

export const Import = defineTaggedUnion({
  Idle: {},
  Reading: {},
  Failed: { problem: DeckCode.DeckCodeProblem },
})
export type Import = typeof Import.Type

export const NEW_DECK_DIALOG_ID = 'new-deck-dialog'
export const IMPORT_DIALOG_ID = 'import-deck-dialog'
export const DELETE_DIALOG_ID = 'delete-deck-dialog'

export const PendingDelete = Schema.Struct({
  deckId: Deck.DeckId,
  name: Schema.String,
})
export type PendingDelete = typeof PendingDelete.Type

export const Model = Schema.Struct({
  cards: Schema.Record(Printing.CardId, Printing.Card),
  newDeckDialog: Dialog.Model,
  importDialog: Dialog.Model,
  deleteDialog: Dialog.Model,
  maybePendingDelete: Schema.Option(PendingDelete),
  toast: Toast.Notification.Model,
  newName: Field(Schema.String),
  importName: Field(Schema.String),
  importCode: Field(Schema.String),
  import: Import,
})
export type Model = typeof Model.Type

export const init = (): Model => ({
  cards: {},
  newDeckDialog: Dialog.init(NEW_DECK_DIALOG_ID),
  importDialog: Dialog.init(IMPORT_DIALOG_ID),
  deleteDialog: Dialog.init(DELETE_DIALOG_ID),
  maybePendingDelete: Option.none(),
  toast: Toast.init('deck-list-toast'),
  newName: NotValidated({ value: '' }),
  importName: NotValidated({ value: '' }),
  importCode: NotValidated({ value: '' }),
  import: Import.Idle(),
})
