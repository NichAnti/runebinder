import { Schema } from 'effect'
import { HttpApiEndpoint, HttpApiGroup } from 'effect/http-api'

import { Deck, Printing, Wishlist as WishlistDomain } from '../domain'
import { Authentication } from './authentication'
import { SetQuantity, UnknownPrinting } from './collection'
import { DeckNotFound } from './deck'

export const LinkedWishlist = Schema.Struct({
  cardTraderWishlistId: WishlistDomain.CardTraderWishlistId,
})
export type LinkedWishlist = typeof LinkedWishlist.Type

const deckIdParams = { deckId: Deck.DeckId }

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
    HttpApiEndpoint.put('linkCustom', '/api/wishlist/cardtrader/custom', {
      payload: LinkedWishlist,
    }),
    HttpApiEndpoint.delete('unlinkCustom', '/api/wishlist/cardtrader/custom'),
    HttpApiEndpoint.put('linkDeck', '/api/wishlist/cardtrader/decks/:deckId', {
      params: deckIdParams,
      payload: LinkedWishlist,
      error: DeckNotFound,
    }),
    HttpApiEndpoint.delete(
      'unlinkDeck',
      '/api/wishlist/cardtrader/decks/:deckId',
      { params: deckIdParams, error: DeckNotFound },
    ),
  )
  .middleware(Authentication) {}
