import { Option, Schema } from 'effect'
import { defineTaggedUnion } from 'foldkit/schema'

import { CatalogueQuery, CatalogueSearch } from '../../../../domain'

export const PAGE_SIZE = 60

export const Results = defineTaggedUnion({
  Waiting: {},
  Showing: {
    query: CatalogueQuery.Query,
    limit: Schema.Int,
    result: CatalogueSearch.SearchResult,
  },
})
export type Results = typeof Results.Type

export const Model = Schema.Struct({
  searchText: Schema.String,
  limit: Schema.Int,
  results: Results,
  isFiltersOpen: Schema.Boolean,
  isShowingAllTags: Schema.Boolean,
})
export type Model = typeof Model.Type

export const init = (query: CatalogueQuery.Query): Model => ({
  searchText: Option.getOrElse(query.q, () => ''),
  limit: PAGE_SIZE,
  results: Results.Waiting(),
  isFiltersOpen: false,
  isShowingAllTags: false,
})
