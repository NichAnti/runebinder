import { Schema } from 'effect'
import { Field, NotValidated } from 'foldkit/fieldValidation'
import { defineTaggedUnion } from 'foldkit/schema'

import { DeckCode, Printing } from '../../../../domain'
import { Dialog } from '../../../../ui'

export const Import = defineTaggedUnion({
  Idle: {},
  Reading: {},
  Failed: { problem: DeckCode.DeckCodeProblem },
})
export type Import = typeof Import.Type

export const NEW_DECK_DIALOG_ID = 'new-deck-dialog'
export const IMPORT_DIALOG_ID = 'import-deck-dialog'

export const Model = Schema.Struct({
  cards: Schema.Record(Printing.CardId, Printing.Card),
  newDeckDialog: Dialog.Model,
  importDialog: Dialog.Model,
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
  newName: NotValidated({ value: '' }),
  importName: NotValidated({ value: '' }),
  importCode: NotValidated({ value: '' }),
  import: Import.Idle(),
})
