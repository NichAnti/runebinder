import { Schema } from 'effect'
import { defineMessageUnion } from 'foldkit/message'

import {
  CatalogueSearch,
  Deck,
  DeckCode,
  DeckEdit,
  DeckRules,
  DeckStructure,
  Printing,
} from '../../../../domain'
import { Toast } from '../../../../ui'
import * as CardPanel from '../../cardPanel'
import { AddTab, Layout } from './model'

export const Message = defineMessageUnion({
  UpdatedName: { value: Schema.String },
  UpdatedSearch: { value: Schema.String },
  SelectedAddTab: { tab: AddTab },
  ClickedProgress: { section: DeckRules.Section },
  CompletedScrollToSection: {},
  ToggledOnlyLegal: { isChecked: Schema.Boolean },
  SelectedLayout: { layout: Layout },
  SucceededSearchCardsToAdd: {
    term: Schema.String,
    tab: AddTab,
    cards: Schema.Array(CatalogueSearch.CardSummary),
  },
  ClickedAddCard: { cardId: Printing.CardId },
  SucceededLoadCardToAdd: { card: Printing.Card, tab: AddTab },
  ClickedStepLine: {
    zone: Deck.Zone,
    printingId: Printing.PrintingId,
    step: DeckEdit.Step,
  },
  GotToastMessage: { message: Toast.Notification.Message },
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
  ClickedSplitRunes: {},
  SucceededFindRunes: { cards: Schema.Array(Printing.Card) },
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
