import { Schema } from 'effect'
import { defineMessageUnion } from 'foldkit/message'

import { Printing, Wishlist } from '../../../domain'
import { SendFailure } from './model'

export const Message = defineMessageUnion({
  SucceededLoadWishlist: { wishlist: Wishlist.Wishlist },
  FailedLoadWishlist: {},
  ElapsedSaveItemDelay: {
    printingId: Printing.PrintingId,
    revision: Schema.Int,
  },
  SucceededSaveItem: { printingId: Printing.PrintingId, revision: Schema.Int },
  FailedSaveItem: { printingId: Printing.PrintingId, revision: Schema.Int },
  ClickedRetryItemSaves: {},
  SucceededSendWishlist: {
    key: Schema.String,
    wishlistId: Wishlist.CardTraderWishlistId,
    isPreviousDeleted: Schema.Boolean,
  },
  FailedSendWishlist: { key: Schema.String, reason: SendFailure },
})
export type Message = typeof Message.Type
