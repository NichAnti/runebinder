import { Array, Option, Record } from 'effect'
import type { Html, HtmlBuilder } from 'foldkit/html'

import { Deck, DeckRules, Printing, Wishlist } from '../../../../domain'
import { Button, CardTile } from '../../../../ui'
import * as CollectionState from '../../collection'
import * as DecksState from '../../decks'
import * as Printings from '../../printings'
import { nameOf } from './lines'
import { Message } from './message'
import { type AddTab, type Model } from './model'

export type ViewInputs = Readonly<{
  decks: DecksState.Model
  deckId: Deck.DeckId
  collection: CollectionState.Model
  maybeWanted: Option.Option<Wishlist.Wanted>
}>

export type Context = Readonly<{
  removal: Option.Option<DecksState.Removal>
  model: Model
  deck: Deck.Deck
  collection: CollectionState.Model
  byPrinting: ReadonlyMap<string, Printing.Card>
  problems: Option.Option<ReadonlyArray<DeckRules.RuleProblem>>
  maybeLegend: Option.Option<Printing.Printing>
  additionalLegendsAsked: number
  maybeWanted: Option.Option<Wishlist.Wanted>
}>

export const TILE_GRID =
  'grid grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-3'

export const SECTION_LABELS: Readonly<Record<DeckRules.Section, string>> = {
  Legend: 'Legend',
  ChosenChampion: 'Chosen champion',
  Main: 'Main deck',
  Runes: 'Runes',
  Battlefields: 'Battlefields',
  Sideboard: 'Sideboard',
  AdditionalLegends: 'Additional legends',
}

export const TAB_LABELS: Readonly<Record<AddTab, string>> = {
  Legend: 'Legends',
  Champion: 'Champions',
  Unit: 'Units',
  Spell: 'Spells',
  Gear: 'Gear',
  Rune: 'Runes',
  Battlefield: 'Battlefields',
  AdditionalLegend: 'Additional legends',
}

export const TARGETS: Readonly<Partial<Record<DeckRules.Section, string>>> = {
  Main: ` / ${DeckRules.CONSTRUCTED_MAIN_DECK_SIZE}`,
  Runes: ` / ${DeckRules.RUNE_DECK_SIZE}`,
  Battlefields: ` / ${DeckRules.CONSTRUCTED_BATTLEFIELDS}`,
  Sideboard: ` / ${DeckRules.MAX_SIDEBOARD}`,
}

// HELPERS

export const printingFinder =
  (byPrinting: ReadonlyMap<string, Printing.Card>) =>
  (printingId: Printing.PrintingId): Option.Option<Printing.Printing> =>
    Option.flatMap(Option.fromNullishOr(byPrinting.get(printingId)), card =>
      Array.findFirst(card.printings, ({ id }) => id === printingId),
    )

export const nameFinder =
  (byPrinting: ReadonlyMap<string, Printing.Card>) =>
  (cardId: Printing.CardId): string =>
    Option.match(
      Array.findFirst(
        Array.fromIterable(byPrinting.values()),
        card => card.id === cardId,
      ),
      { onNone: () => cardId, onSome: nameOf },
    )

export const problemsIn = (
  context: Context,
  section: DeckRules.Section,
): ReadonlyArray<DeckRules.RuleProblem> =>
  Option.match(context.problems, {
    onNone: () => [],
    onSome: Array.filter(problem => DeckRules.sectionOf(problem) === section),
  })

export const badgesFor = (
  context: Context,
  printingIds: ReadonlyArray<Printing.PrintingId>,
): ReadonlyArray<string> =>
  Printings.badgesOf(
    CollectionState.maybeOwned(context.collection),
    context.maybeWanted,
    printingIds,
  )

export const smallButton = (
  content: string,
  onClick: Message,
  h: HtmlBuilder<Message>,
): Html => Button.view({ content: [content], variant: 'Secondary', onClick }, h)

export const tileOf = (
  card: Printing.Card,
  printingId: Printing.PrintingId,
  highlights: ReadonlyArray<string>,
  meta = '',
): CardTile.ViewConfig => {
  const printing = Option.getOrElse(
    Array.findFirst(card.printings, ({ id }) => id === printingId),
    () => Printing.basePrinting(card),
  )

  return {
    imageUrl: printing.imageUrl,
    imageAlt: Option.getOrElse(
      printing.maybeAccessibilityText,
      () => printing.name,
    ),
    title: printing.name,
    maybeSubtitle: printing.maybeSubtitle,
    domains: printing.domains,
    meta,
    highlights,
  }
}
