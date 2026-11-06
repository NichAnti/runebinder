import { Option, Schema } from 'effect'

import { CardTraderImport, Printing, Wishlist } from '../../../../domain'
import { Toast } from '../../../../ui'

export const Matched = Schema.Struct({
  wishlistId: Wishlist.CardTraderWishlistId,
  lines: Schema.Array(CardTraderImport.ImportLine),
  cards: Schema.Record(Printing.CardId, Printing.Card),
})
export type Matched = typeof Matched.Type

export const Model = Schema.Struct({
  maybeMatched: Schema.Option(Matched),
  selected: Schema.Record(Schema.String, Schema.Boolean),
  toast: Toast.Notification.Model,
})
export type Model = typeof Model.Type

export const init = (): Model => ({
  maybeMatched: Option.none(),
  selected: {},
  toast: Toast.init('cardtrader-wishlist-toast'),
})
