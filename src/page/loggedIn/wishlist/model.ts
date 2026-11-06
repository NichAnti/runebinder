import { Schema } from 'effect'
import { defineTaggedUnion } from 'foldkit/schema'

import { Collection, Printing, Wishlist } from '../../../domain'

export const Save = defineTaggedUnion({
  Waiting: { revision: Schema.Int },
  Saving: { revision: Schema.Int },
  Failed: { revision: Schema.Int },
})
export type Save = typeof Save.Type

export const Action = Schema.Literals(['Create', 'Sync', 'Delete'])
export type Action = typeof Action.Type

export const Failure = Schema.Literals([
  'NotConnected',
  'InvalidToken',
  'RateLimited',
  'Unavailable',
  'NotSaved',
])
export type Failure = typeof Failure.Type

export const Operation = defineTaggedUnion({
  Working: { action: Action },
  Failed: { action: Action, reason: Failure },
})
export type Operation = typeof Operation.Type

export const Model = defineTaggedUnion({
  NotLoaded: {},
  Loading: {},
  Failed: {},
  Ready: {
    added: Collection.Owned,
    links: Schema.Record(Schema.String, Wishlist.CardTraderWishlistId),
    saves: Schema.Record(Printing.PrintingId, Save),
    nextRevision: Schema.Int,
    operations: Schema.Record(Schema.String, Operation),
  },
})
export type Model = typeof Model.Type
export type Ready = typeof Model.Ready.Type

export const init = (): Model => Model.NotLoaded()
