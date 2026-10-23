import { Schema } from 'effect'

import { CatalogueSearch, Printing } from '../../../../domain'

export const Model = Schema.Struct({
  cards: Schema.Record(Printing.CardId, Printing.Card),
  searchText: Schema.String,
  searchResults: Schema.Array(CatalogueSearch.CardSummary),
})
export type Model = typeof Model.Type

export const init = (): Model => ({
  cards: {},
  searchText: '',
  searchResults: [],
})
