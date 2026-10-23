import { Option } from 'effect'
import { describe, expect, test } from 'vitest'

import { CatalogueQuery, Deck } from './domain'
import { AppRoute, collectionRouter, deckRouter, urlToAppRoute } from './route'

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
  test('/collection is the collection page', () => {
    expect(routeOf('/collection')).toStrictEqual(
      AppRoute.Collection(CatalogueQuery.empty),
    )
    expect(collectionRouter(CatalogueQuery.empty)).toBe('/collection')
  })

  test('/decks lists decks and /decks/{id} opens one', () => {
    const deckId = Deck.DeckId.make('7b0f2a7e-2a9c-4c6e-9d2b-6a6f1c9d2e11')

    expect(routeOf('/decks')).toStrictEqual(AppRoute.Decks())
    expect(routeOf(`/decks/${deckId}`)).toStrictEqual(AppRoute.Deck({ deckId }))
    expect(deckRouter({ deckId })).toBe(`/decks/${deckId}`)
    expect(routeOf('/decks/not-a-deck')._tag).toBe('NotFound')
  })

  test('/wishlist is the wishlist page', () => {
    expect(routeOf('/wishlist')).toStrictEqual(AppRoute.Wishlist())
  })

  test('/cardtrader is the CardTrader page', () => {
    expect(routeOf('/cardtrader')).toStrictEqual(AppRoute.CardTrader())
  })
})
