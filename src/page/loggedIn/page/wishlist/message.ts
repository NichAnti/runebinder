import { Schema } from 'effect'
import { defineMessageUnion } from 'foldkit/message'

import {
  CatalogueSearch,
  DeckEdit,
  Printing,
  Wishlist,
} from '../../../../domain'
import { Dialog, Toast } from '../../../../ui'

export const Purchase = Schema.Struct({
  wanted: Printing.PrintingId,
  bought: Printing.PrintingId,
  copies: Schema.Int,
  isCustom: Schema.Boolean,
})
export type Purchase = typeof Purchase.Type

const Outgoing = {
  wishlist: Wishlist.WishlistRef,
  name: Schema.String,
  lines: Schema.NonEmptyArray(
    Schema.Struct({
      blueprintId: Printing.CardTraderBlueprintId,
      quantity: Schema.Int,
    }),
  ),
}

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
  ClickedRemoveAdded: { printingId: Printing.PrintingId },
  ToggledLine: { lineKey: Schema.String, isChecked: Schema.Boolean },
  SelectedVersion: { lineKey: Schema.String, value: Schema.String },
  ClickedBought: { purchases: Schema.NonEmptyArray(Purchase) },
  ClickedCreate: { wishlist: Wishlist.WishlistRef },
  ClickedSync: { wishlist: Wishlist.WishlistRef },
  ClickedDelete: { wishlist: Wishlist.WishlistRef },
  ClickedDeleteRemote: {
    wishlistId: Wishlist.CardTraderWishlistId,
    name: Schema.String,
  },
  ClickedConfirm: {},
  ClickedConnect: {},
  ClickedRefreshRemote: {},
  ClickedRetry: {},
  GotConfirmDialogMessage: { message: Dialog.Message },
  GotToastMessage: { message: Toast.Notification.Message },
})
export type Message = typeof Message.Type

export const OutMessage = defineMessageUnion({
  SteppedAdded: { printingId: Printing.PrintingId, step: DeckEdit.Step },
  RemovedAdded: { printingId: Printing.PrintingId },
  MarkedBought: { purchases: Schema.NonEmptyArray(Purchase) },
  RequestedCreate: Outgoing,
  RequestedSync: Outgoing,
  RequestedDelete: { wishlist: Wishlist.WishlistRef },
  RequestedDeleteRemote: { wishlistId: Wishlist.CardTraderWishlistId },
  RequestedConnect: {},
  RequestedRefreshRemote: {},
  RequestedRetry: {},
})
export type OutMessage = typeof OutMessage.Type
