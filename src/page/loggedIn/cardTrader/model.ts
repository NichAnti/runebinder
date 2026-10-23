import { Option, Redacted, Schema } from 'effect'
import { defineTaggedUnion } from 'foldkit/schema'

import { CardTraderFailure } from '../../../service'
import { Dialog } from '../../../ui'

export const Connection = defineTaggedUnion({
  NotChecked: {},
  Checking: {},
  Disconnected: { wasRejected: Schema.Boolean },
  Connected: {
    isRemembered: Schema.Boolean,
    maybeAppName: Schema.Option(Schema.String),
  },
})
export type Connection = typeof Connection.Type

export const Submission = defineTaggedUnion({
  Idle: {},
  Connecting: {},
  Failed: { reason: CardTraderFailure },
})
export type Submission = typeof Submission.Type

export const TokenProblem = Schema.Literals(['Missing', 'Malformed'])
export type TokenProblem = typeof TokenProblem.Type

export const Model = Schema.Struct({
  connection: Connection,
  dialog: Dialog.Model,
  tokenInput: Schema.Redacted(Schema.String),
  maybeTokenProblem: Schema.Option(TokenProblem),
  isRemembered: Schema.Boolean,
  submission: Submission,
})
export type Model = typeof Model.Type

export const DIALOG_ID = 'cardtrader-connect'

export const init = (): Model => ({
  connection: Connection.NotChecked(),
  dialog: Dialog.init(DIALOG_ID),
  tokenInput: Redacted.make(''),
  maybeTokenProblem: Option.none(),
  isRemembered: false,
  submission: Submission.Idle(),
})
