import { Array, Number, Option, Order, Record, Schema, pipe } from 'effect'

import { PrintingId, SetCode, setReleaseRank } from './printing'

export const MAX_QUANTITY = 999

export const Quantity = Schema.Int.check(
  Schema.isBetween({ minimum: 0, maximum: MAX_QUANTITY }),
).pipe(Schema.brand('Quantity'))
export type Quantity = typeof Quantity.Type

export const OwnedQuantity = Schema.Int.check(
  Schema.isBetween({ minimum: 1, maximum: MAX_QUANTITY }),
).pipe(Schema.brand('OwnedQuantity'))
export type OwnedQuantity = typeof OwnedQuantity.Type

export const CollectionItem = Schema.Struct({
  printingId: PrintingId,
  quantity: OwnedQuantity,
})
export type CollectionItem = typeof CollectionItem.Type

export const Owned = Schema.Record(PrintingId, OwnedQuantity)
export type Owned = typeof Owned.Type

export const NONE = Quantity.make(0)

export const toOwned = (quantity: Quantity): Option.Option<OwnedQuantity> =>
  Schema.decodeOption(OwnedQuantity)(quantity)

export const fromItems = (items: ReadonlyArray<CollectionItem>): Owned =>
  Record.fromEntries(
    Array.map(items, ({ printingId, quantity }) => [printingId, quantity]),
  )

export const quantityOf = (owned: Owned, printingId: PrintingId): Quantity =>
  pipe(
    Record.get(owned, printingId),
    Option.match({ onNone: () => NONE, onSome: Quantity.make }),
  )

export const withQuantity = (
  owned: Owned,
  printingId: PrintingId,
  quantity: Quantity,
): Owned =>
  Option.match(toOwned(quantity), {
    onNone: () => Record.remove(owned, printingId),
    onSome: ownedQuantity => Record.set(owned, printingId, ownedQuantity),
  })

export const totalOf = (
  owned: Owned,
  printingIds: ReadonlyArray<PrintingId>,
): number => Number.sumAll(Array.map(printingIds, id => quantityOf(owned, id)))

export const adjust = (quantity: Quantity, step: -1 | 1): Quantity =>
  Option.getOrElse(
    Schema.decodeOption(Quantity)(quantity + step),
    () => quantity,
  )

// SUMMARY

export const PrintingSets = Schema.Record(PrintingId, SetCode)
export type PrintingSets = typeof PrintingSets.Type

export type SetProgress = Readonly<{
  set: SetCode
  ownedPrintings: number
  totalPrintings: number
}>

export type Summary = Readonly<{
  copies: number
  printings: number
  sets: ReadonlyArray<SetProgress>
}>

const bySetRelease = Order.mapInput(Order.Number, ({ set }: SetProgress) =>
  setReleaseRank(set),
)

export const summarize = (
  owned: Owned,
  printingSets: PrintingSets,
): Summary => {
  const bySet = Array.groupBy(Record.toEntries(printingSets), ([, set]) => set)

  return {
    copies: Number.sumAll(Record.values(owned)),
    printings: Record.size(owned),
    sets: pipe(
      Record.toEntries(bySet),
      Array.map(([set, entries]) => ({
        set: SetCode.make(set),
        ownedPrintings: Array.length(
          Array.filter(entries, ([printingId]) =>
            Record.has(owned, printingId),
          ),
        ),
        totalPrintings: Array.length(entries),
      })),
      Array.sort(bySetRelease),
    ),
  }
}

export const clampQuantity = (count: number): Quantity =>
  Option.getOrElse(
    Schema.decodeOption(Quantity)(
      Number.clamp(count, { minimum: 0, maximum: MAX_QUANTITY }),
    ),
    () => NONE,
  )
