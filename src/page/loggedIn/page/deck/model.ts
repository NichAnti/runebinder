import { Option, Schema } from 'effect'
import { Field, NotValidated } from 'foldkit/fieldValidation'
import { defineTaggedUnion } from 'foldkit/schema'

import {
  CatalogueSearch,
  Deck,
  DeckCode,
  type DeckRules,
  DeckStructure,
  Printing,
} from '../../../../domain'
import { Toast } from '../../../../ui'
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
  panels: Schema.Record(DeckStructure.Place, CardPanel.Model),
  toast: Toast.Notification.Model,
  isConfirmingDelete: Schema.Boolean,
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
  isConfirmingDelete: false,
  export: Export.Idle(),
})
