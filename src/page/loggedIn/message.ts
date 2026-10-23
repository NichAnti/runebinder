import { Schema } from 'effect'
import { defineMessageUnion } from 'foldkit/message'

import { CatalogueSearch, Collection } from '../../domain'
import * as CollectionState from './collection'
import * as DecksState from './decks'
import * as CardPage from './page/card'
import * as CardTraderPage from './page/cardTrader'
import * as CataloguePage from './page/catalogue'
import * as DeckPage from './page/deck'
import * as DeckListPage from './page/deckList'

export const Message = defineMessageUnion({
  GotCataloguePageMessage: { message: CataloguePage.Message },
  GotCollectionPageMessage: { message: CataloguePage.Message },
  ClickedRefreshCollection: {},
  GotCardPageMessage: { message: CardPage.Message },
  GotCardTraderPageMessage: { message: CardTraderPage.Message },
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
  CompletedOpenDeck: {},
  CompletedReturnToDecks: {},
})
export type Message = typeof Message.Type
