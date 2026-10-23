import { Array, Match, Number, Option, Order, Schema, pipe } from 'effect'

import {
  Copies,
  type DeckCard,
  type DeckContents,
  DeckName,
  MAX_COPIES,
  Zone,
} from './deck'
import { CardType, PrintingId } from './printing'

export const Step = Schema.Literals([-1, 1])
export type Step = typeof Step.Type

export const MovableZone = Schema.Literals(['Main', 'Sideboard'])
export type MovableZone = typeof MovableZone.Type

export const DeckEdit = Schema.Union([
  Schema.TaggedStruct('Rename', { name: DeckName }),
  Schema.TaggedStruct('AddCard', {
    printingId: PrintingId,
    maybeType: Schema.Option(CardType),
  }),
  Schema.TaggedStruct('StepCopies', {
    zone: Zone,
    printingId: PrintingId,
    step: Step,
  }),
  Schema.TaggedStruct('MoveCard', {
    from: MovableZone,
    to: MovableZone,
    printingId: PrintingId,
  }),
  Schema.TaggedStruct('MakeChampion', { printingId: PrintingId }),
  Schema.TaggedStruct('SetChampion', { printingId: PrintingId }),
  Schema.TaggedStruct('ClearChampion', {}),
  Schema.TaggedStruct('ClearLegend', {}),
  Schema.TaggedStruct('AddAdditionalLegend', { printingId: PrintingId }),
  Schema.TaggedStruct('RemoveAdditionalLegend', { position: Schema.Int }),
])
export type DeckEdit = typeof DeckEdit.Type

// ZONES

const cardsIn = (contents: DeckContents, zone: Zone): ReadonlyArray<DeckCard> =>
  Match.value(zone).pipe(
    Match.withReturnType<ReadonlyArray<DeckCard>>(),
    Match.when('Main', () => contents.main),
    Match.when('Runes', () => contents.runes),
    Match.when('Battlefields', () => contents.battlefields),
    Match.when('Sideboard', () => contents.sideboard),
    Match.exhaustive,
  )

const withCards = (
  contents: DeckContents,
  zone: Zone,
  cards: ReadonlyArray<DeckCard>,
): DeckContents =>
  Match.value(zone).pipe(
    Match.withReturnType<DeckContents>(),
    Match.when('Main', () => ({ ...contents, main: cards })),
    Match.when('Runes', () => ({ ...contents, runes: cards })),
    Match.when('Battlefields', () => ({ ...contents, battlefields: cards })),
    Match.when('Sideboard', () => ({ ...contents, sideboard: cards })),
    Match.exhaustive,
  )

export const copiesOf = (
  contents: DeckContents,
  zone: Zone,
  printingId: PrintingId,
): number =>
  pipe(
    Array.findFirst(
      cardsIn(contents, zone),
      card => card.printingId === printingId,
    ),
    Option.match({ onNone: () => 0, onSome: ({ copies }) => copies }),
  )

const byPrinting = Order.mapInput(
  Order.String,
  ({ printingId }: DeckCard) => printingId,
)

const withCopies = (
  cards: ReadonlyArray<DeckCard>,
  printingId: PrintingId,
  count: number,
): ReadonlyArray<DeckCard> => {
  const others = Array.filter(cards, card => card.printingId !== printingId)

  return Option.match(
    Schema.decodeOption(Copies)(Number.min(count, MAX_COPIES)),
    {
      onNone: () => others,
      onSome: copies =>
        Array.sort(Array.append(others, { printingId, copies }), byPrinting),
    },
  )
}

const addCopies = (
  contents: DeckContents,
  zone: Zone,
  printingId: PrintingId,
  count: number,
): DeckContents =>
  withCards(
    contents,
    zone,
    withCopies(
      cardsIn(contents, zone),
      printingId,
      copiesOf(contents, zone, printingId) + count,
    ),
  )

// EDITS

export const zoneForType = (maybeType: Option.Option<CardType>): Zone =>
  Option.match(maybeType, {
    onNone: () => 'Main',
    onSome: type =>
      Match.value(type).pipe(
        Match.withReturnType<Zone>(),
        Match.when('Rune', () => 'Runes'),
        Match.when('Battlefield', () => 'Battlefields'),
        Match.orElse(() => 'Main'),
      ),
  })

const isLegend = (maybeType: Option.Option<CardType>): boolean =>
  Option.exists(maybeType, type => type === 'Legend')

const championBackToMain = (contents: DeckContents): DeckContents =>
  Option.match(contents.maybeChosenChampion, {
    onNone: () => contents,
    onSome: champion => ({
      ...addCopies(contents, 'Main', champion, 1),
      maybeChosenChampion: Option.none(),
    }),
  })

export const applyEdit = (
  contents: DeckContents,
  edit: Exclude<DeckEdit, { _tag: 'Rename' }>,
): DeckContents =>
  Match.value(edit).pipe(
    Match.withReturnType<DeckContents>(),
    Match.tagsExhaustive({
      AddCard: ({ printingId, maybeType }) =>
        isLegend(maybeType)
          ? { ...contents, maybeLegend: Option.some(printingId) }
          : addCopies(contents, zoneForType(maybeType), printingId, 1),
      StepCopies: ({ zone, printingId, step }) =>
        addCopies(contents, zone, printingId, step),
      MoveCard: ({ from, to, printingId }) => {
        const moving = copiesOf(contents, from, printingId)

        return addCopies(
          addCopies(contents, from, printingId, -moving),
          to,
          printingId,
          moving,
        )
      },
      MakeChampion: ({ printingId }) => {
        const withoutChampion = championBackToMain(contents)

        return {
          ...addCopies(withoutChampion, 'Main', printingId, -1),
          maybeChosenChampion: Option.some(printingId),
        }
      },
      SetChampion: ({ printingId }) => ({
        ...contents,
        maybeChosenChampion: Option.some(printingId),
      }),
      ClearChampion: () => championBackToMain(contents),
      ClearLegend: () => ({ ...contents, maybeLegend: Option.none() }),
      AddAdditionalLegend: ({ printingId }) => ({
        ...contents,
        additionalLegends: Array.append(contents.additionalLegends, printingId),
      }),
      RemoveAdditionalLegend: ({ position }) => ({
        ...contents,
        additionalLegends: Array.remove(contents.additionalLegends, position),
      }),
    }),
  )
