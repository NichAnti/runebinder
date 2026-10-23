import { Schema } from 'effect'
import { defineTaggedUnion } from 'foldkit/schema'

import { Collection, Printing, Wishlist } from '../../../domain'

export const Save = defineTaggedUnion({
  Waiting: { revision: Schema.Int },
  Saving: { revision: Schema.Int },
  Failed: { revision: Schema.Int },
})
export type Save = typeof Save.Type

export const SendFailure = Schema.Literals([
  'NotConnected',
  'InvalidToken',
  'RateLimited',
  'Unavailable',
])
export type SendFailure = typeof SendFailure.Type

export const Sending = defineTaggedUnion({
  Idle: {},
  Sending: {},
  Sent: {
    wishlistId: Wishlist.CardTraderWishlistId,
    isPreviousDeleted: Schema.Boolean,
  },
  Failed: { reason: SendFailure },
})
export type Sending = typeof Sending.Type

export const Model = defineTaggedUnion({
  NotLoaded: {},
  Loading: {},
  Failed: {},
  Ready: {
    added: Collection.Owned,
    maybeSentWishlistId: Schema.Option(Wishlist.CardTraderWishlistId),
    saves: Schema.Record(Printing.PrintingId, Save),
    nextRevision: Schema.Int,
    sending: Sending,
  },
})
export type Model = typeof Model.Type
export type Ready = typeof Model.Ready.Type

export const init = (): Model => Model.NotLoaded()
