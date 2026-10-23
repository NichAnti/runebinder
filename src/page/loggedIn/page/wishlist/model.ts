import { Option, Schema } from 'effect'
import { defineTaggedUnion } from 'foldkit/schema'

import { CatalogueSearch, Printing, Wishlist } from '../../../../domain'
import { Dialog, Toast } from '../../../../ui'

export const Pending = defineTaggedUnion({
  Sync: { wishlist: Wishlist.WishlistRef, title: Schema.String },
  DeleteLinked: { wishlist: Wishlist.WishlistRef, title: Schema.String },
  DeleteRemote: {
    wishlistId: Wishlist.CardTraderWishlistId,
    name: Schema.String,
  },
})
export type Pending = typeof Pending.Type

export const CONFIRM_DIALOG_ID = 'wishlist-confirm'

export const Model = Schema.Struct({
  cards: Schema.Record(Printing.CardId, Printing.Card),
  searchText: Schema.String,
  searchResults: Schema.Array(CatalogueSearch.CardSummary),
  selected: Schema.Record(Schema.String, Schema.Boolean),
  versions: Schema.Record(Schema.String, Printing.PrintingId),
  maybePending: Schema.Option(Pending),
  confirmDialog: Dialog.Model,
  toast: Toast.Notification.Model,
})
export type Model = typeof Model.Type

export const init = (): Model => ({
  cards: {},
  searchText: '',
  searchResults: [],
  selected: {},
  versions: {},
  maybePending: Option.none(),
  confirmDialog: Dialog.init(CONFIRM_DIALOG_ID),
  toast: Toast.init('wishlist-toast'),
})
