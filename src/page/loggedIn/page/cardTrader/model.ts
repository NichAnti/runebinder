import { Option, Redacted, Schema } from 'effect'
import { defineTaggedUnion } from 'foldkit/schema'

import { CardTraderFailure } from '../../../../service'

export const Connection = defineTaggedUnion({
  Checking: {},
  Disconnected: {},
  Connecting: {},
  Connected: { appName: Schema.String, isRemembered: Schema.Boolean },
  Failed: { reason: CardTraderFailure },
})
export type Connection = typeof Connection.Type

export const TokenProblem = Schema.Literals(['Missing', 'Malformed'])
export type TokenProblem = typeof TokenProblem.Type

export const Model = Schema.Struct({
  connection: Connection,
  tokenInput: Schema.Redacted(Schema.String),
  maybeTokenProblem: Schema.Option(TokenProblem),
  isRemembered: Schema.Boolean,
})
export type Model = typeof Model.Type

export const init = (): Model => ({
  connection: Connection.Checking(),
  tokenInput: Redacted.make(''),
  maybeTokenProblem: Option.none(),
  isRemembered: false,
})
