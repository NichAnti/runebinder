import { Schema } from 'effect'
import { defineTaggedUnion } from 'foldkit/schema'

import { CardTraderImport } from '../../../domain'
import { CardTraderFailure, ListedWishlist } from '../../../service'

export const Listing = defineTaggedUnion({
  NotLoaded: {},
  Loading: {},
  Ready: { wishlists: Schema.Array(ListedWishlist) },
  Failed: { reason: CardTraderFailure },
})
export type Listing = typeof Listing.Type

export const Detail = defineTaggedUnion({
  Loading: {},
  Ready: { wishlist: CardTraderImport.RemoteWishlist },
  Failed: { reason: CardTraderFailure },
})
export type Detail = typeof Detail.Type

export const Deletion = defineTaggedUnion({
  Deleting: {},
  Failed: { reason: CardTraderFailure },
})
export type Deletion = typeof Deletion.Type

export const Model = Schema.Struct({
  listing: Listing,
  details: Schema.Record(Schema.String, Detail),
  deletions: Schema.Record(Schema.String, Deletion),
})
export type Model = typeof Model.Type

export const init = (): Model => ({
  listing: Listing.NotLoaded(),
  details: {},
  deletions: {},
})
