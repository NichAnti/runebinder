import { Schema } from 'effect'
import { defineMessageUnion } from 'foldkit/message'

import {
  CatalogueSearch,
  Deck,
  DeckCode,
  DeckEdit,
  DeckStructure,
  Printing,
} from '../../../../domain'
import * as CardPanel from '../../cardPanel'

export const Message = defineMessageUnion({
  UpdatedName: { value: Schema.String },
  UpdatedSearch: { value: Schema.String },
  SucceededSearchCardsToAdd: {
    term: Schema.String,
    cards: Schema.Array(CatalogueSearch.CardSummary),
  },
  ClickedAddCard: {
    cardId: Printing.CardId,
    isAdditionalLegend: Schema.Boolean,
  },
  SucceededLoadCardToAdd: {
    card: Printing.Card,
    isAdditionalLegend: Schema.Boolean,
  },
  SucceededLoadDeckCards: { cards: Schema.Array(Printing.Card) },
  SkippedLoadCatalogue: {},
  GotCardPanelMessage: {
    panelId: DeckStructure.Place,
    message: CardPanel.Message,
  },
  ClickedMoveLine: {
    from: DeckEdit.MovableZone,
    to: DeckEdit.MovableZone,
    printingIds: Schema.Array(Printing.PrintingId),
  },
  ClickedMakeChampion: { printingId: Printing.PrintingId },
  ClickedClearLegend: {},
  ClickedClearChampion: {},
  ClickedRemoveAdditionalLegend: { position: Schema.Int },
  ClickedCopyCode: {},
  CompletedCopyDeckCode: { code: DeckCode.DeckCode },
  FailedCopyDeckCode: { code: DeckCode.DeckCode },
  ClickedDelete: {},
  ClickedCancelDelete: {},
  ClickedConfirmDelete: {},
  ClickedRetryLoadDecks: {},
})
export type Message = typeof Message.Type

export const OutMessage = defineMessageUnion({
  EditedDeck: {
    deckId: Deck.DeckId,
    edits: Schema.NonEmptyArray(DeckEdit.DeckEdit),
  },
  RequestedRemoveDeck: { deckId: Deck.DeckId },
  RequestedRetryLoadDecks: {},
})
export type OutMessage = typeof OutMessage.Type
