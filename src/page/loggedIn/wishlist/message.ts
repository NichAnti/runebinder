import { Schema } from 'effect'
import { defineMessageUnion } from 'foldkit/message'

import { Printing, Wishlist } from '../../../domain'
import { Action, Failure } from './model'

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
  SucceededCreateOnCardTrader: {
    wishlist: Wishlist.WishlistRef,
    cardTraderWishlistId: Wishlist.CardTraderWishlistId,
    name: Schema.String,
  },
  SucceededSyncOnCardTrader: {
    wishlist: Wishlist.WishlistRef,
    cardTraderWishlistId: Wishlist.CardTraderWishlistId,
    name: Schema.String,
    previousId: Wishlist.CardTraderWishlistId,
    isPreviousDeleted: Schema.Boolean,
  },
  SucceededDeleteOnCardTrader: {
    wishlist: Wishlist.WishlistRef,
    cardTraderWishlistId: Wishlist.CardTraderWishlistId,
  },
  FailedCardTraderOperation: {
    wishlist: Wishlist.WishlistRef,
    action: Action,
    reason: Failure,
  },
})
export type Message = typeof Message.Type
