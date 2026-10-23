import { Schema } from 'effect'
import { defineTaggedUnion } from 'foldkit/schema'

import { Collection, Deck, Printing, Wishlist } from '../../../domain'

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

export const SendTarget = Schema.Union([
  Schema.TaggedStruct('Custom', {}),
  Schema.TaggedStruct('Deck', { deckId: Deck.DeckId, deckName: Schema.String }),
])
export type SendTarget = typeof SendTarget.Type

export const CUSTOM_KEY = 'custom'

export const targetKey = (target: SendTarget): string =>
  target._tag === 'Custom' ? CUSTOM_KEY : target.deckId

export const wishlistNameOf = (target: SendTarget): string =>
  target._tag === 'Custom'
    ? 'Custom wishlist (cardtrader app)'
    : `${target.deckName} (cardtrader app)`

export const Model = defineTaggedUnion({
  NotLoaded: {},
  Loading: {},
  Failed: {},
  Ready: {
    added: Collection.Owned,
    maybeSentWishlistId: Schema.Option(Wishlist.CardTraderWishlistId),
    saves: Schema.Record(Printing.PrintingId, Save),
    nextRevision: Schema.Int,
    sendings: Schema.Record(Schema.String, Sending),
  },
})
export type Model = typeof Model.Type
export type Ready = typeof Model.Ready.Type

export const init = (): Model => Model.NotLoaded()
