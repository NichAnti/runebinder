import { Schema } from 'effect'
import { defineMessageUnion } from 'foldkit/message'

import { CardTraderImport, Printing, Wishlist } from '../../../../domain'
import { Toast } from '../../../../ui'

export const Message = defineMessageUnion({
  SucceededMatchLines: {
    wishlistId: Wishlist.CardTraderWishlistId,
    lines: Schema.Array(CardTraderImport.ImportLine),
    cards: Schema.Array(Printing.Card),
  },
  SkippedMatchLines: {},
  ToggledLine: { key: Schema.String, isChecked: Schema.Boolean },
  ClickedImport: { keys: Schema.NonEmptyArray(Schema.String) },
  ClickedConnect: {},
  ClickedRetry: {},
  GotToastMessage: { message: Toast.Notification.Message },
})
export type Message = typeof Message.Type

export const OutMessage = defineMessageUnion({
  Imported: {
    items: Schema.NonEmptyArray(
      Schema.Struct({ printingId: Printing.PrintingId, quantity: Schema.Int }),
    ),
  },
  RequestedConnect: {},
  RequestedRetry: {},
})
export type OutMessage = typeof OutMessage.Type
