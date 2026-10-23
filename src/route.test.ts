import { Option } from 'effect'
import { describe, expect, test } from 'vitest'

import { CatalogueQuery, Deck, Wishlist } from './domain'
import {
  AppRoute,
  cardTraderWishlistRouter,
  catalogueRouter,
  deckRouter,
  urlToAppRoute,
  wishlistHref,
} from './route'

const routeOf = (path: string) =>
  urlToAppRoute({
    protocol: 'https:',
    host: 'example.com',
    port: Option.none(),
    pathname: path,
    search: Option.none(),
    hash: Option.none(),
  })

describe('routes', () => {
  test('/collection is gone; the collection is a view of /', () => {
    expect(routeOf('/collection')._tag).toBe('NotFound')
    expect(
      catalogueRouter({ ...CatalogueQuery.empty, ownership: 'Owned' }),
    ).toBe('/?ownership=owned')
  })

  test('/decks lists decks and /decks/{id} opens one', () => {
    const deckId = Deck.DeckId.make('7b0f2a7e-2a9c-4c6e-9d2b-6a6f1c9d2e11')

    expect(routeOf('/decks')).toStrictEqual(AppRoute.Decks())
    expect(routeOf(`/decks/${deckId}`)).toStrictEqual(AppRoute.Deck({ deckId }))
    expect(deckRouter({ deckId })).toBe(`/decks/${deckId}`)
    expect(routeOf('/decks/not-a-deck')._tag).toBe('NotFound')
  })

  test('/wishlists lists wishlists and each one has its own page', () => {
    const deckId = Deck.DeckId.make('7b0f2a7e-2a9c-4c6e-9d2b-6a6f1c9d2e11')

    expect(routeOf('/wishlists')).toStrictEqual(AppRoute.Wishlists())
    expect(routeOf('/wishlists/custom')).toStrictEqual(
      AppRoute.CustomWishlist(),
    )
    expect(routeOf(`/wishlists/${deckId}`)).toStrictEqual(
      AppRoute.DeckWishlist({ deckId }),
    )
    expect(wishlistHref(Wishlist.CUSTOM)).toBe('/wishlists/custom')
    expect(wishlistHref(Wishlist.deckWishlist(deckId))).toBe(
      `/wishlists/${deckId}`,
    )
    expect(routeOf('/wishlists/not-a-deck')._tag).toBe('NotFound')
  })

  test('/cardtrader/wishlists/{id} is a CardTrader wishlist', () => {
    const wishlistId = Wishlist.CardTraderWishlistId.make(3572164)

    expect(routeOf('/cardtrader/wishlists/3572164')).toStrictEqual(
      AppRoute.CardTraderWishlist({ wishlistId }),
    )
    expect(cardTraderWishlistRouter({ wishlistId })).toBe(
      '/cardtrader/wishlists/3572164',
    )
    expect(routeOf('/cardtrader/wishlists/0')._tag).toBe('NotFound')
  })

  test('/cardtrader is the CardTrader page', () => {
    expect(routeOf('/cardtrader')).toStrictEqual(AppRoute.CardTrader())
  })
})
