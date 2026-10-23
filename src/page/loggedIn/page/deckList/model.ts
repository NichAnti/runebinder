import { Schema } from 'effect'
import { Field, NotValidated } from 'foldkit/fieldValidation'
import { defineTaggedUnion } from 'foldkit/schema'

import { DeckCode } from '../../../../domain'

export const Import = defineTaggedUnion({
  Idle: {},
  Reading: {},
  Failed: { problem: DeckCode.DeckCodeProblem },
})
export type Import = typeof Import.Type

export const Model = Schema.Struct({
  newName: Field(Schema.String),
  importName: Field(Schema.String),
  importCode: Field(Schema.String),
  import: Import,
})
export type Model = typeof Model.Type

export const init = (): Model => ({
  newName: NotValidated({ value: '' }),
  importName: NotValidated({ value: '' }),
  importCode: NotValidated({ value: '' }),
  import: Import.Idle(),
})
