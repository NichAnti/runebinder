import { Schema } from 'effect'
import { defineMessageUnion } from 'foldkit/message'

import { CardTraderImport, Wishlist } from '../../../domain'
import { CardTraderFailure, ListedWishlist } from '../../../service'

export const Message = defineMessageUnion({
  SucceededListWishlists: { wishlists: Schema.Array(ListedWishlist) },
  FailedListWishlists: { reason: CardTraderFailure },
  SucceededShowWishlist: { wishlist: CardTraderImport.RemoteWishlist },
  FailedShowWishlist: {
    wishlistId: Wishlist.CardTraderWishlistId,
    reason: CardTraderFailure,
  },
  SucceededDeleteWishlist: { wishlistId: Wishlist.CardTraderWishlistId },
  FailedDeleteWishlist: {
    wishlistId: Wishlist.CardTraderWishlistId,
    reason: CardTraderFailure,
  },
})
export type Message = typeof Message.Type
