import { Schema } from 'effect'
import { defineMessageUnion } from 'foldkit/message'

import { CatalogueSearch, Collection } from '../../domain'
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

export const Message = defineMessageUnion({
  GotCataloguePageMessage: { message: CataloguePage.Message },
  GotCardPageMessage: { message: CardPage.Message },
  GotCardTraderMessage: { message: CardTraderState.Message },
  GotCardTraderWishlistsMessage: { message: CardTraderWishlists.Message },
  GotCardTraderWishlistPageMessage: {
    message: CardTraderWishlistPage.Message,
  },
  AcquiredCatalogueIndex: {
    allValues: CatalogueSearch.Facets,
    printingSets: Collection.PrintingSets,
  },
  ReleasedCatalogueIndex: {},
  FailedAcquireCatalogueIndex: { reason: Schema.String },
  ClickedRetryCatalogue: {},
  GotCollectionMessage: { message: CollectionState.Message },
  GotDecksMessage: { message: DecksState.Message },
  GotDeckListPageMessage: { message: DeckListPage.Message },
  GotDeckPageMessage: { message: DeckPage.Message },
  GotWishlistMessage: { message: WishlistState.Message },
  GotWishlistPageMessage: { message: WishlistPage.Message },
  CompletedOpenDeck: {},
  CompletedReturnToDecks: {},
})
export type Message = typeof Message.Type
