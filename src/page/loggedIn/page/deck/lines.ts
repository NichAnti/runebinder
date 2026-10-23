import {
  Array,
  Number,
  Option,
  Order,
  Record,
  Result,
  Schema,
  pipe,
} from 'effect'

import { type Deck, Printing } from '../../../../domain'

export type Line = Readonly<{
  key: string
  maybeCard: Option.Option<Printing.Card>
  label: string
  cards: Array.NonEmptyReadonlyArray<Deck.DeckCard>
  copies: number
}>

export const cardsByPrinting = (
  cards: Readonly<Record<string, Printing.Card>>,
): ReadonlyMap<string, Printing.Card> =>
  new Map(
    Array.flatMap(Record.values(cards), card =>
      Array.map(card.printings, ({ id }): readonly [string, Printing.Card] => [
        id,
        card,
      ]),
    ),
  )

export const nameOf = (card: Printing.Card): string => {
  const { name, maybeSubtitle } = Printing.basePrinting(card)

  return Option.match(maybeSubtitle, {
    onNone: () => name,
    onSome: subtitle => `${name}, ${subtitle}`,
  })
}

const byLabel = Order.mapInput(Order.String, ({ label }: Line) => label)

export const linesOf = (
  zoneCards: ReadonlyArray<Deck.DeckCard>,
  byPrinting: ReadonlyMap<string, Printing.Card>,
): ReadonlyArray<Line> =>
  pipe(
    Array.groupBy(zoneCards, ({ printingId }) =>
      Option.match(Option.fromNullishOr(byPrinting.get(printingId)), {
        onNone: () => printingId,
        onSome: card => card.id,
      }),
    ),
    Record.toEntries,
    Array.map(([key, cards]) => {
      const maybeCard = Option.fromNullishOr(
        byPrinting.get(Array.headNonEmpty(cards).printingId),
      )

      return {
        key,
        maybeCard,
        label: Option.match(maybeCard, { onNone: () => key, onSome: nameOf }),
        cards,
        copies: Number.sumAll(Array.map(cards, ({ copies }) => copies)),
      }
    }),
    Array.sort(byLabel),
  )

export const quantitiesOf = (
  printingIds: ReadonlyArray<Printing.PrintingId>,
): Readonly<Record<string, number>> =>
  Array.reduce(printingIds, Record.empty<string, number>(), (counts, id) =>
    Record.set(
      counts,
      id,
      Option.getOrElse(Record.get(counts, id), () => 0) + 1,
    ),
  )

export const isChampionUnit = (card: Printing.Card): boolean => {
  const base = Printing.basePrinting(card)

  return (
    Option.exists(base.maybeType, type => type === 'Unit') &&
    Array.contains(base.supertypes, 'Champion')
  )
}

const energyOf = ({ maybeCard }: Line): number =>
  Option.getOrElse(
    Option.flatMap(maybeCard, card => Printing.basePrinting(card).maybeEnergy),
    () => 0,
  )

const byEnergy = Order.mapInput(Order.Number, energyOf)

export const byEnergyThenLabel: Order.Order<Line> = Order.combine(
  byEnergy,
  byLabel,
)

export const TypeGroup = Schema.Literals(['Unit', 'Spell', 'Gear', 'Other'])
export type TypeGroup = typeof TypeGroup.Type

const groupOf = ({ maybeCard }: Line): TypeGroup =>
  Option.match(
    Option.flatMap(maybeCard, card => Printing.basePrinting(card).maybeType),
    {
      onNone: () => 'Other',
      onSome: type =>
        type === 'Unit' || type === 'Spell' || type === 'Gear' ? type : 'Other',
    },
  )

export type TypeGroupLines = Readonly<{
  group: TypeGroup
  lines: Array.NonEmptyReadonlyArray<Line>
}>

export const groupsOf = (
  lines: ReadonlyArray<Line>,
): ReadonlyArray<TypeGroupLines> =>
  Array.filterMap(TypeGroup.literals, group =>
    Array.match(
      Array.sort(
        Array.filter(lines, line => groupOf(line) === group),
        byEnergyThenLabel,
      ),
      {
        onEmpty: () => Result.failVoid,
        onNonEmpty: groupLines => Result.succeed({ group, lines: groupLines }),
      },
    ),
  )

export const CURVE_TOP = 7

export const energyCurveOf = (
  lines: ReadonlyArray<Line>,
): ReadonlyArray<number> =>
  Array.makeBy(CURVE_TOP + 1, energy =>
    Number.sumAll(
      Array.map(
        Array.filter(lines, line =>
          energy === CURVE_TOP
            ? energyOf(line) >= CURVE_TOP
            : energyOf(line) === energy,
        ),
        ({ copies }) => copies,
      ),
    ),
  )
