import { Schema } from 'effect'
import { defineMessageUnion } from 'foldkit/message'

import { CatalogueSearch, Collection } from '../../domain'
import * as CollectionState from './collection'
import * as CardPage from './page/card'
import * as CardTraderPage from './page/cardTrader'
import * as CataloguePage from './page/catalogue'

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
})
export type Message = typeof Message.Type
