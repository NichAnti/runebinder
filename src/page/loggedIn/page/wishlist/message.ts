import { Schema } from 'effect'
import { defineMessageUnion } from 'foldkit/message'

import { CatalogueSearch, DeckEdit, Printing } from '../../../../domain'

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
  ClickedSend: {},
  ClickedRetry: {},
})
export type Message = typeof Message.Type

export const OutMessage = defineMessageUnion({
  SteppedAdded: { printingId: Printing.PrintingId, step: DeckEdit.Step },
  RequestedSend: {
    name: Schema.String,
    lines: Schema.NonEmptyArray(
      Schema.Struct({
        blueprintId: Printing.CardTraderBlueprintId,
        quantity: Schema.Int,
      }),
    ),
  },
  RequestedRetry: {},
})
export type OutMessage = typeof OutMessage.Type
