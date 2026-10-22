import { Schema } from 'effect'
import { defineMessageUnion } from 'foldkit/message'

import { CatalogueSearch } from '../../domain'
import * as CardPage from './page/card'
import * as CardTraderPage from './page/cardTrader'
import * as CataloguePage from './page/catalogue'

export const Message = defineMessageUnion({
  GotCataloguePageMessage: { message: CataloguePage.Message },
  GotCardPageMessage: { message: CardPage.Message },
  GotCardTraderPageMessage: { message: CardTraderPage.Message },
  AcquiredCatalogueIndex: { allValues: CatalogueSearch.Facets },
  ReleasedCatalogueIndex: {},
  FailedAcquireCatalogueIndex: { reason: Schema.String },
  ClickedRetryCatalogue: {},
})
export type Message = typeof Message.Type
