import { Option, Schema } from 'effect'
import { Field, NotValidated } from 'foldkit/fieldValidation'
import { defineTaggedUnion } from 'foldkit/schema'

import {
  CatalogueSearch,
  Deck,
  DeckCode,
  DeckStructure,
  Printing,
} from '../../../../domain'
import * as CardPanel from '../../cardPanel'

export const Export = defineTaggedUnion({
  Idle: {},
  Copied: { code: DeckCode.DeckCode },
  CopyFailed: { code: DeckCode.DeckCode },
  NotEncodable: { problem: DeckCode.DeckCodeProblem },
})
export type Export = typeof Export.Type

export const Model = Schema.Struct({
  maybeDeckId: Schema.Option(Deck.DeckId),
  cards: Schema.Record(Printing.CardId, Printing.Card),
  name: Field(Schema.String),
  searchText: Schema.String,
  searchResults: Schema.Array(CatalogueSearch.CardSummary),
  panels: Schema.Record(DeckStructure.Place, CardPanel.Model),
  isConfirmingDelete: Schema.Boolean,
  export: Export,
})
export type Model = typeof Model.Type

export const PLACES = DeckStructure.Place.literals

export const init = (): Model => ({
  maybeDeckId: Option.none(),
  cards: {},
  name: NotValidated({ value: '' }),
  searchText: '',
  searchResults: [],
  panels: {
    Legend: CardPanel.init(),
    ChosenChampion: CardPanel.init(),
    Main: CardPanel.init(),
    Runes: CardPanel.init(),
    Battlefields: CardPanel.init(),
    Sideboard: CardPanel.init(),
    AdditionalLegends: CardPanel.init(),
  },
  isConfirmingDelete: false,
  export: Export.Idle(),
})
