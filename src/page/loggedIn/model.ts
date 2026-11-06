import { Schema } from 'effect'
import { defineTaggedUnion, taggedStruct } from 'foldkit/schema'

import { CatalogueQuery, CatalogueSearch, Collection, User } from '../../domain'
import { LoggedInRoute } from '../../route'
import * as CardTraderState from './cardTrader'
import * as CardTraderWishlists from './cardTraderWishlists'
import * as CollectionState from './collection'
import * as DecksState from './decks'
import * as CardPage from './page/card'
import * as CardTraderWishlistPage from './page/cardTraderWishlist'
import * as CataloguePage from './page/catalogue'
import * as DeckPage from './page/deck'
import * as DeckListPage from './page/deckList'
import * as WishlistPage from './page/wishlist'
import * as WishlistState from './wishlist'

export const CatalogueState = defineTaggedUnion({
  Loading: { attempt: Schema.Int },
  Ready: {
    attempt: Schema.Int,
    allValues: CatalogueSearch.Facets,
    printingSets: Collection.PrintingSets,
  },
  Failed: { attempt: Schema.Int },
})
export type CatalogueState = typeof CatalogueState.Type

export const Model = taggedStruct('LoggedIn', {
  route: LoggedInRoute,
  user: User.User,
  catalogue: CatalogueState,
  collection: CollectionState.Model,
  decks: DecksState.Model,
  wishlist: WishlistState.Model,
  cardTrader: CardTraderState.Model,
  cardTraderWishlists: CardTraderWishlists.Model,
  cataloguePage: CataloguePage.Model,
  cardPage: CardPage.Model,
  cardTraderWishlistPage: CardTraderWishlistPage.Model,
  deckListPage: DeckListPage.Model,
  deckPage: DeckPage.Model,
  wishlistPage: WishlistPage.Model,
})
export type Model = typeof Model.Type

export const init = (route: LoggedInRoute, user: User.User): Model =>
  Model({
    route,
    user,
    catalogue: CatalogueState.Loading({ attempt: 0 }),
    collection: CollectionState.init(),
    decks: DecksState.init(),
    wishlist: WishlistState.init(),
    cardTrader: CardTraderState.init(),
    cardTraderWishlists: CardTraderWishlists.init(),
    cataloguePage: CataloguePage.init(
      route._tag === 'Catalogue' ? route : CatalogueQuery.empty,
    ),
    cardPage: CardPage.init(),
    cardTraderWishlistPage: CardTraderWishlistPage.init(),
    deckListPage: DeckListPage.init(),
    deckPage: DeckPage.init(),
    wishlistPage: WishlistPage.init(),
  })
