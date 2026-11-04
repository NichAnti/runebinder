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
import { Tabs, Toast } from '../../../../ui'
import * as CardPanel from '../../cardPanel'
import { AddTab, AddTarget, Layout } from './model'

export const Message = defineMessageUnion({
  UpdatedName: { value: Schema.String },
  UpdatedSearch: { value: Schema.String },
  SelectedAddTab: { tab: AddTab },
  ClickedProgress: { section: DeckRules.Section },
  CompletedScrollToSection: {},
  ClickedToggleSheet: {},
  ToggledOnlyLegal: { isChecked: Schema.Boolean },
  SelectedLayout: { layout: Layout },
  SucceededSearchCardsToAdd: {
    term: Schema.String,
    tab: AddTab,
    cards: Schema.Array(CatalogueSearch.CardSummary),
  },
  ClickedAddCard: { cardId: Printing.CardId, target: AddTarget },
  SucceededLoadCardToAdd: {
    card: Printing.Card,
    tab: AddTab,
    target: AddTarget,
  },
  ClickedStepCopies: {
    cardId: Printing.CardId,
    maybeVersion: Schema.Option(Printing.PrintingId),
    zone: Deck.Zone,
    step: DeckEdit.Step,
  },
  SelectedVersion: {
    zone: Deck.Zone,
    from: Printing.PrintingId,
    value: Schema.String,
  },
  SelectedSlotVersion: {
    place: Schema.Literals(['Legend', 'ChosenChampion']),
    value: Schema.String,
  },
  ClickedStepLine: {
    zone: Deck.Zone,
    printingId: Printing.PrintingId,
    step: DeckEdit.Step,
  },
  GotToastMessage: { message: Toast.Notification.Message },
  GotSideTabsMessage: { message: Tabs.Message },
  SucceededLoadDeckCards: { cards: Schema.Array(Printing.Card) },
  SkippedLoadCatalogue: {},
  GotCardPanelMessage: {
    panelId: DeckStructure.Place,
    message: CardPanel.Message,
  },
  ClickedMakeChampion: { printingId: Printing.PrintingId },
  ClickedClearLegend: {},
  ClickedClearChampion: {},
  ClickedRemoveAdditionalLegend: { position: Schema.Int },
  ClickedSplitRunes: {},
  SucceededFindRunes: { cards: Schema.Array(Printing.Card) },
  ClickedUndo: {},
  ClickedDismissUndo: {},
  CompletedWaitBeforeClearingUndo: { id: Schema.Int },
  ClickedCopyCode: {},
  ClickedDuplicate: {},
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
  RequestedDuplicateDeck: { name: Deck.DeckName, contents: Deck.DeckContents },
  SteppedOwned: { printingId: Printing.PrintingId, step: DeckEdit.Step },
  RequestedCollectionRetry: {},
  RequestedRetryLoadDecks: {},
})
export type OutMessage = typeof OutMessage.Type
