import { Schema } from 'effect'
import { defineMessageUnion } from 'foldkit/message'

import { CatalogueQuery, CatalogueSearch, Printing } from '../../../../domain'
import * as CardPanel from '../../cardPanel'
import { Step } from '../../collection'

export const Message = defineMessageUnion({
  UpdatedSearch: { value: Schema.String },
  ToggledFilter: { facet: CatalogueSearch.FacetName, value: Schema.String },
  ChangedRange: {
    field: CatalogueQuery.RangeField,
    bound: CatalogueQuery.Bound,
    value: Schema.Option(Schema.Int),
  },
  SelectedSort: { value: Schema.String },
  SelectedOwnership: { value: Schema.String },
  ClickedClearFilters: {},
  ClickedShowMore: {},
  ToggledFiltersPanel: { isOpen: Schema.Boolean },
  ClickedShowAllTags: {},
  CompletedReplaceQuery: {},
  SucceededSearchCatalogue: {
    query: CatalogueQuery.Query,
    limit: Schema.Int,
    result: CatalogueSearch.SearchResult,
  },
  SkippedSearchCatalogue: {},
  GotCardPanelMessage: { message: CardPanel.Message },
})
export type Message = typeof Message.Type

export const OutMessage = defineMessageUnion({
  SteppedQuantity: { printingId: Printing.PrintingId, step: Step },
  RequestedCollectionRetry: {},
})
export type OutMessage = typeof OutMessage.Type
