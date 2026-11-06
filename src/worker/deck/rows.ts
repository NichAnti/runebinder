import { createSelectSchema } from 'drizzle-orm/effect-schema'
import { Array, Option, Order, Schema, pipe } from 'effect'

import { Deck, Printing, User } from '../../domain'
import { deck, deckAdditionalLegend, deckCard } from '../schema'

export const DeckRow = createSelectSchema(deck, {
  id: Deck.DeckId,
  userId: User.UserId,
  name: Deck.DeckName,
  legendPrintingId: Schema.OptionFromNullOr(Printing.PrintingId),
  chosenChampionPrintingId: Schema.OptionFromNullOr(Printing.PrintingId),
})
export type DeckRow = typeof DeckRow.Type

export const DeckCardRow = createSelectSchema(deckCard, {
  deckId: Deck.DeckId,
  zone: Deck.Zone,
  printingId: Printing.PrintingId,
  copies: Deck.Copies,
})
export type DeckCardRow = typeof DeckCardRow.Type

export const AdditionalLegendRow = createSelectSchema(deckAdditionalLegend, {
  deckId: Deck.DeckId,
  position: Schema.Int,
  printingId: Printing.PrintingId,
})
export type AdditionalLegendRow = typeof AdditionalLegendRow.Type

const byPrinting = Order.mapInput(
  Order.String,
  ({ printingId }: DeckCardRow) => printingId,
)
const byPosition = Order.mapInput(
  Order.Number,
  ({ position }: AdditionalLegendRow) => position,
)

const zoneCards = (
  cards: ReadonlyArray<DeckCardRow>,
  zone: Deck.Zone,
): ReadonlyArray<Deck.DeckCard> =>
  pipe(
    cards,
    Array.filter(card => card.zone === zone),
    Array.sort(byPrinting),
    Array.map(({ printingId, copies }) => ({ printingId, copies })),
  )

export const toDeck = (
  row: DeckRow,
  cards: ReadonlyArray<DeckCardRow>,
  legends: ReadonlyArray<AdditionalLegendRow>,
): Deck.Deck => ({
  id: row.id,
  name: row.name,
  contents: {
    maybeLegend: row.legendPrintingId,
    maybeChosenChampion: row.chosenChampionPrintingId,
    main: zoneCards(cards, 'Main'),
    runes: zoneCards(cards, 'Runes'),
    battlefields: zoneCards(cards, 'Battlefields'),
    sideboard: zoneCards(cards, 'Sideboard'),
    additionalLegends: pipe(
      legends,
      Array.sort(byPosition),
      Array.map(({ printingId }) => printingId),
    ),
  },
})

export const toDecks = (
  decks: ReadonlyArray<DeckRow>,
  cards: ReadonlyArray<DeckCardRow>,
  legends: ReadonlyArray<AdditionalLegendRow>,
): ReadonlyArray<Deck.Deck> =>
  Array.map(decks, row =>
    toDeck(
      row,
      Array.filter(cards, ({ deckId }) => deckId === row.id),
      Array.filter(legends, ({ deckId }) => deckId === row.id),
    ),
  )

export const cardRowsOf = (
  deckId: Deck.DeckId,
  contents: Deck.DeckContents,
): ReadonlyArray<DeckCardRow> => {
  const rowsIn = (zone: Deck.Zone, cards: Deck.ZoneCards) =>
    Array.map(cards, ({ printingId, copies }) => ({
      deckId,
      zone,
      printingId,
      copies,
    }))

  return [
    ...rowsIn('Main', contents.main),
    ...rowsIn('Runes', contents.runes),
    ...rowsIn('Battlefields', contents.battlefields),
    ...rowsIn('Sideboard', contents.sideboard),
  ]
}

export const legendRowsOf = (
  deckId: Deck.DeckId,
  contents: Deck.DeckContents,
): ReadonlyArray<AdditionalLegendRow> =>
  Array.map(contents.additionalLegends, (printingId, position) => ({
    deckId,
    position,
    printingId,
  }))

export const legendColumns = (contents: Deck.DeckContents) => ({
  legendPrintingId: Option.getOrNull(contents.maybeLegend),
  chosenChampionPrintingId: Option.getOrNull(contents.maybeChosenChampion),
})
