import { Array, Number, Option, Schema, String } from 'effect'

import { PrintingId } from './printing'

export const MAX_NAME_LENGTH = 80
export const MAX_COPIES = 999

export const DeckId = Schema.String.check(Schema.isUUID(4)).pipe(
  Schema.brand('DeckId'),
)
export type DeckId = typeof DeckId.Type

export const DeckName = Schema.Trimmed.check(
  Schema.isNonEmpty(),
  Schema.isMaxLength(MAX_NAME_LENGTH),
).pipe(Schema.brand('DeckName'))
export type DeckName = typeof DeckName.Type

export const parseName = (raw: string): Option.Option<DeckName> =>
  Schema.decodeOption(DeckName)(String.trim(raw))

export const Copies = Schema.Int.check(
  Schema.isBetween({ minimum: 1, maximum: MAX_COPIES }),
).pipe(Schema.brand('Copies'))
export type Copies = typeof Copies.Type

export const Zone = Schema.Literals([
  'Main',
  'Runes',
  'Battlefields',
  'Sideboard',
])
export type Zone = typeof Zone.Type

export const DeckCard = Schema.Struct({
  printingId: PrintingId,
  copies: Copies,
})
export type DeckCard = typeof DeckCard.Type

const hasDistinctPrintings = Schema.makeFilter(
  (cards: ReadonlyArray<DeckCard>) =>
    Array.length(
      Array.dedupe(Array.map(cards, ({ printingId }) => printingId)),
    ) === Array.length(cards) || 'each printing appears once per zone',
)

export const ZoneCards = Schema.Array(DeckCard).check(hasDistinctPrintings)
export type ZoneCards = typeof ZoneCards.Type

export const DeckContents = Schema.Struct({
  maybeLegend: Schema.Option(PrintingId),
  maybeChosenChampion: Schema.Option(PrintingId),
  main: ZoneCards,
  runes: ZoneCards,
  battlefields: ZoneCards,
  sideboard: ZoneCards,
  additionalLegends: Schema.Array(PrintingId),
})
export type DeckContents = typeof DeckContents.Type

export const empty: DeckContents = {
  maybeLegend: Option.none(),
  maybeChosenChampion: Option.none(),
  main: [],
  runes: [],
  battlefields: [],
  sideboard: [],
  additionalLegends: [],
}

export const Deck = Schema.Struct({
  id: DeckId,
  name: DeckName,
  contents: DeckContents,
})
export type Deck = typeof Deck.Type

export const copiesIn = (cards: ReadonlyArray<DeckCard>): number =>
  Number.sumAll(Array.map(cards, ({ copies }) => copies))

export const mainDeckSize = (contents: DeckContents): number =>
  copiesIn(contents.main) +
  (Option.isSome(contents.maybeChosenChampion) ? 1 : 0)
