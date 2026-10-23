import { Schema } from 'effect'

import { CatalogueSearch, Printing } from '../../../../domain'
import { Toast } from '../../../../ui'

export const Model = Schema.Struct({
  cards: Schema.Record(Printing.CardId, Printing.Card),
  searchText: Schema.String,
  searchResults: Schema.Array(CatalogueSearch.CardSummary),
  selected: Schema.Record(Schema.String, Schema.Boolean),
  versions: Schema.Record(Schema.String, Printing.PrintingId),
  toast: Toast.Notification.Model,
})
export type Model = typeof Model.Type

export const init = (): Model => ({
  cards: {},
  searchText: '',
  searchResults: [],
  selected: {},
  versions: {},
  toast: Toast.init('wishlist-toast'),
})
