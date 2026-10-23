import { Schema } from 'effect'
import { defineMessageUnion } from 'foldkit/message'

import { CatalogueSearch, DeckEdit, Printing } from '../../../../domain'
import { Toast } from '../../../../ui'
import { SendTarget } from '../../wishlist'

export const Purchase = Schema.Struct({
  wanted: Printing.PrintingId,
  bought: Printing.PrintingId,
  copies: Schema.Int,
  isCustom: Schema.Boolean,
})
export type Purchase = typeof Purchase.Type

export const Message = defineMessageUnion({
  SucceededLoadWishlistCards: { cards: Schema.Array(Printing.Card) },
  SkippedLoadCatalogue: {},
  UpdatedSearch: { value: Schema.String },
  SucceededSearchCardsToWish: {
    term: Schema.String,
    cards: Schema.Array(CatalogueSearch.CardSummary),
  },
  ClickedAddCard: { cardId: Printing.CardId },
  SucceededLoadCardToWish: { card: Printing.Card },
  ClickedStepAdded: { printingId: Printing.PrintingId, step: DeckEdit.Step },
  ToggledLine: { lineKey: Schema.String, isChecked: Schema.Boolean },
  SelectedVersion: { lineKey: Schema.String, value: Schema.String },
  ClickedBought: { purchases: Schema.NonEmptyArray(Purchase) },
  ClickedSend: { target: SendTarget },
  ClickedRetry: {},
  GotToastMessage: { message: Toast.Notification.Message },
})
export type Message = typeof Message.Type

export const OutMessage = defineMessageUnion({
  SteppedAdded: { printingId: Printing.PrintingId, step: DeckEdit.Step },
  RequestedSend: {
    target: SendTarget,
    lines: Schema.NonEmptyArray(
      Schema.Struct({
        blueprintId: Printing.CardTraderBlueprintId,
        quantity: Schema.Int,
      }),
    ),
  },
  MarkedBought: { purchases: Schema.NonEmptyArray(Purchase) },
  RequestedRetry: {},
})
export type OutMessage = typeof OutMessage.Type
