import { Option, Schema } from 'effect'
import { Field, NotValidated } from 'foldkit/fieldValidation'
import { defineTaggedUnion } from 'foldkit/schema'

import {
  CatalogueSearch,
  Deck,
  DeckCode,
  DeckEdit,
  type DeckRules,
  DeckStructure,
  Printing,
} from '../../../../domain'
import { Dialog, Tabs, Toast } from '../../../../ui'
import * as CardPanel from '../../cardPanel'

export const Export = defineTaggedUnion({
  Idle: {},
  Copied: { code: DeckCode.DeckCode },
  CopyFailed: { code: DeckCode.DeckCode },
  NotEncodable: { problem: DeckCode.DeckCodeProblem },
})
export type Export = typeof Export.Type

export const AddTab = Schema.Literals([
  'Legend',
  'Champion',
  'Unit',
  'Spell',
  'Gear',
  'Rune',
  'Battlefield',
  'AdditionalLegend',
])
export type AddTab = typeof AddTab.Type

export const AddTarget = Schema.Literals(['Deck', 'Sideboard'])
export type AddTarget = typeof AddTarget.Type

export const TAB_FOR_SECTION: Readonly<Record<DeckRules.Section, AddTab>> = {
  Legend: 'Legend',
  ChosenChampion: 'Champion',
  Main: 'Unit',
  Runes: 'Rune',
  Battlefields: 'Battlefield',
  Sideboard: 'Unit',
  AdditionalLegends: 'AdditionalLegend',
}

export const sectionElementId = (section: DeckRules.Section): string =>
  `deck-section-${section}`

export const Undo = Schema.Struct({
  id: Schema.Int,
  text: Schema.String,
  edits: Schema.NonEmptyArray(DeckEdit.DeckEdit),
})
export type Undo = typeof Undo.Type

export const SidePanel = Schema.Literals(['Stats', 'Add'])
export type SidePanel = typeof SidePanel.Type

export const SideTabs = Tabs.create<SidePanel>()

export const DELETE_DIALOG_ID = 'delete-deck-dialog'

export const Layout = Schema.Literals(['Grid', 'List'])
export type Layout = typeof Layout.Type

export const Model = Schema.Struct({
  maybeDeckId: Schema.Option(Deck.DeckId),
  cards: Schema.Record(Printing.CardId, Printing.Card),
  name: Field(Schema.String),
  addTab: AddTab,
  searchText: Schema.String,
  searchResults: Schema.Array(CatalogueSearch.CardSummary),
  isOnlyLegal: Schema.Boolean,
  layout: Layout,
  sidePanel: SidePanel,
  sideTabs: Tabs.Model,
  isSheetOpen: Schema.Boolean,
  panels: Schema.Record(DeckStructure.Place, CardPanel.Model),
  toast: Toast.Notification.Model,
  deleteDialog: Dialog.Model,
  maybeUndo: Schema.Option(Undo),
  nextUndoId: Schema.Int,
  export: Export,
})
export type Model = typeof Model.Type

export const defaultTab = (contents: Deck.DeckContents): AddTab => {
  if (Option.isNone(contents.maybeLegend)) {
    return 'Legend'
  } else if (Option.isNone(contents.maybeChosenChampion)) {
    return 'Champion'
  } else {
    return 'Unit'
  }
}

export const init = (): Model => ({
  maybeDeckId: Option.none(),
  cards: {},
  name: NotValidated({ value: '' }),
  addTab: 'Legend',
  searchText: '',
  searchResults: [],
  isOnlyLegal: true,
  layout: 'Grid',
  sidePanel: 'Stats',
  sideTabs: Tabs.init('deck-side'),
  isSheetOpen: false,
  panels: {
    Legend: CardPanel.init(),
    ChosenChampion: CardPanel.init(),
    Main: CardPanel.init(),
    Runes: CardPanel.init(),
    Battlefields: CardPanel.init(),
    Sideboard: CardPanel.init(),
    AdditionalLegends: CardPanel.init(),
  },
  toast: Toast.init('deck-toast'),
  deleteDialog: Dialog.init(DELETE_DIALOG_ID),
  maybeUndo: Option.none(),
  nextUndoId: 0,
  export: Export.Idle(),
})
