import { Array, Number, Option, Order, Record, Result, pipe } from 'effect'

import { type Owned, quantityOf } from './collection'
import type { Deck, DeckContents } from './deck'
import type { PrintingId } from './printing'

export type Need = Readonly<{
  printingId: PrintingId
  needed: number
  owned: number
  missing: number
}>

const add = (
  counts: Readonly<Record<PrintingId, number>>,
  printingId: PrintingId,
  copies: number,
): Readonly<Record<PrintingId, number>> =>
  Record.set(
    counts,
    printingId,
    Option.getOrElse(Record.get(counts, printingId), () => 0) + copies,
  )

export const copiesUsedBy = (
  contents: DeckContents,
): Readonly<Record<PrintingId, number>> =>
  Array.reduce(
    [
      ...Array.map(Option.toArray(contents.maybeLegend), printingId => ({
        printingId,
        copies: 1,
      })),
      ...Array.map(
        Option.toArray(contents.maybeChosenChampion),
        printingId => ({
          printingId,
          copies: 1,
        }),
      ),
      ...contents.main,
      ...contents.runes,
      ...contents.battlefields,
      ...contents.sideboard,
      ...Array.map(contents.additionalLegends, printingId => ({
        printingId,
        copies: 1,
      })),
    ],
    Record.empty<PrintingId, number>(),
    (counts, { printingId, copies }) => add(counts, printingId, copies),
  )

const neededAcross = (
  decks: ReadonlyArray<Deck>,
): Readonly<Record<PrintingId, number>> =>
  Array.reduce(decks, Record.empty<PrintingId, number>(), (most, deck) =>
    Record.union(most, copiesUsedBy(deck.contents), Number.max),
  )

const byPrinting = Order.mapInput(
  Order.String,
  ({ printingId }: Need) => printingId,
)

export const needs = (
  decks: ReadonlyArray<Deck>,
  owned: Owned,
): ReadonlyArray<Need> =>
  pipe(
    neededAcross(decks),
    Record.toEntries,
    Array.map(([printingId, needed]): Need => {
      const ownedCopies = quantityOf(owned, printingId)

      return {
        printingId,
        needed,
        owned: ownedCopies,
        missing: Number.max(0, needed - ownedCopies),
      }
    }),
    Array.sort(byPrinting),
  )

export const missingOnly = (
  allNeeds: ReadonlyArray<Need>,
): ReadonlyArray<Need> => Array.filter(allNeeds, ({ missing }) => missing > 0)

export type DeckUse = Readonly<{ deck: Deck; copies: number }>

export const decksUsing = (
  decks: ReadonlyArray<Deck>,
  printingIds: ReadonlyArray<PrintingId>,
): ReadonlyArray<DeckUse> =>
  Array.filterMap(decks, deck => {
    const used = copiesUsedBy(deck.contents)
    const copies = Number.sumAll(
      Array.map(printingIds, printingId =>
        Option.getOrElse(Record.get(used, printingId), () => 0),
      ),
    )

    return copies > 0 ? Result.succeed({ deck, copies }) : Result.failVoid
  })
