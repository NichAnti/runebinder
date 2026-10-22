import { Schema } from 'effect'
import { defineMessageUnion } from 'foldkit/message'

import { CatalogueQuery, CatalogueSearch } from '../../../../domain'

export const Message = defineMessageUnion({
  UpdatedSearch: { value: Schema.String },
  ToggledFilter: { facet: CatalogueSearch.FacetName, value: Schema.String },
  ChangedRange: {
    field: CatalogueQuery.RangeField,
    bound: CatalogueQuery.Bound,
    value: Schema.Option(Schema.Int),
  },
  SelectedSort: { value: Schema.String },
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
})
export type Message = typeof Message.Type
