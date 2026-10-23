import { Schema } from 'effect'
import { HttpApiEndpoint, HttpApiGroup } from 'effect/http-api'

import { Printing, Wishlist as WishlistDomain } from '../domain'
import { Authentication } from './authentication'
import { SetQuantity, UnknownPrinting } from './collection'

export const SentWishlist = Schema.Struct({
  wishlistId: WishlistDomain.CardTraderWishlistId,
})

export const ReplacedWishlist = Schema.Struct({
  maybePreviousWishlistId: Schema.Option(WishlistDomain.CardTraderWishlistId),
})
export type ReplacedWishlist = typeof ReplacedWishlist.Type

export class Wishlist extends HttpApiGroup.make('wishlist')
  .add(
    HttpApiEndpoint.get('show', '/api/wishlist', {
      success: WishlistDomain.Wishlist,
    }),
    HttpApiEndpoint.put('setItem', '/api/wishlist/items/:printingId', {
      params: { printingId: Printing.PrintingId },
      payload: SetQuantity,
      error: UnknownPrinting,
    }),
    HttpApiEndpoint.put(
      'replaceCardTraderWishlist',
      '/api/wishlist/cardtrader',
      {
        payload: SentWishlist,
        success: ReplacedWishlist,
      },
    ),
  )
  .middleware(Authentication) {}
