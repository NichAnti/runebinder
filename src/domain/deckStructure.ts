import { Array, Option, Result, Schema } from 'effect'

import type { DeckContents } from './deck'
import { type CardType, type KnownPrinting, PrintingId } from './printing'

export const Place = Schema.Literals([
  'Legend',
  'ChosenChampion',
  'Main',
  'Runes',
  'Battlefields',
  'Sideboard',
  'AdditionalLegends',
])
export type Place = typeof Place.Type

export const StructureProblem = Schema.Union([
  Schema.TaggedStruct('UnknownPrinting', {
    place: Place,
    printingId: PrintingId,
  }),
  Schema.TaggedStruct('WrongCardType', {
    place: Place,
    printingId: PrintingId,
  }),
])
export type StructureProblem = typeof StructureProblem.Type

const ALLOWED_TYPES: Readonly<Record<Place, ReadonlyArray<CardType>>> = {
  Legend: ['Legend'],
  ChosenChampion: ['Unit'],
  Main: ['Unit', 'Spell', 'Gear'],
  Runes: ['Rune'],
  Battlefields: ['Battlefield'],
  Sideboard: ['Unit', 'Spell', 'Gear'],
  AdditionalLegends: ['Legend'],
}

export type FindPrinting = (
  printingId: PrintingId,
) => Option.Option<KnownPrinting>

type Placed = Readonly<{ place: Place; printingId: PrintingId }>

const at =
  (place: Place) =>
  (printingId: PrintingId): Placed => ({ place, printingId })

const cardsAt = (
  place: Place,
  cards: DeckContents['main'],
): ReadonlyArray<Placed> =>
  Array.map(cards, ({ printingId }) => at(place)(printingId))

const placed = (contents: DeckContents): ReadonlyArray<Placed> => [
  ...Array.map(Option.toArray(contents.maybeLegend), at('Legend')),
  ...Array.map(
    Option.toArray(contents.maybeChosenChampion),
    at('ChosenChampion'),
  ),
  ...cardsAt('Main', contents.main),
  ...cardsAt('Runes', contents.runes),
  ...cardsAt('Battlefields', contents.battlefields),
  ...cardsAt('Sideboard', contents.sideboard),
  ...Array.map(contents.additionalLegends, at('AdditionalLegends')),
]

export const structureProblems = (
  contents: DeckContents,
  find: FindPrinting,
): ReadonlyArray<StructureProblem> =>
  Array.filterMap(placed(contents), ({ place, printingId }) =>
    Option.match(find(printingId), {
      onNone: () =>
        Result.succeed<StructureProblem>({
          _tag: 'UnknownPrinting',
          place,
          printingId,
        }),
      onSome: ({ maybeType }) =>
        Option.exists(maybeType, type =>
          Array.contains(ALLOWED_TYPES[place], type),
        )
          ? Result.failVoid
          : Result.succeed<StructureProblem>({
              _tag: 'WrongCardType',
              place,
              printingId,
            }),
    }),
  )
