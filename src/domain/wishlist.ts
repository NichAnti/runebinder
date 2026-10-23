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

import { type Owned, OwnedQuantity, quantityOf } from './collection'
import type { Need } from './missing'
import { CardTraderBlueprintId, type Printing, PrintingId } from './printing'

export const CardTraderWishlistId = Schema.Int.check(
  Schema.isGreaterThan(0),
).pipe(Schema.brand('CardTraderWishlistId'))
export type CardTraderWishlistId = typeof CardTraderWishlistId.Type

export const WishlistItem = Schema.Struct({
  printingId: PrintingId,
  quantity: OwnedQuantity,
})
export type WishlistItem = typeof WishlistItem.Type

export const Wishlist = Schema.Struct({
  items: Schema.Array(WishlistItem),
  maybeCardTraderWishlistId: Schema.Option(CardTraderWishlistId),
})
export type Wishlist = typeof Wishlist.Type

export type Line = Readonly<{
  printingId: PrintingId
  missing: number
  added: number
  quantity: number
}>

const byPrinting = Order.mapInput(
  Order.String,
  ({ printingId }: Line) => printingId,
)

export const linesOf = (
  needs: ReadonlyArray<Need>,
  added: Owned,
): ReadonlyArray<Line> => {
  const missingBy = Record.fromEntries(
    Array.map(
      Array.filter(needs, ({ missing }) => missing > 0),
      ({ printingId, missing }): readonly [PrintingId, number] => [
        printingId,
        missing,
      ],
    ),
  )
  const printingIds = Array.dedupe([
    ...Record.keys(missingBy),
    ...Record.keys(added),
  ])

  return pipe(
    printingIds,
    Array.map((printingId): Line => {
      const missing = Option.getOrElse(
        Record.get(missingBy, printingId),
        () => 0,
      )
      const extra = quantityOf(added, printingId)

      return { printingId, missing, added: extra, quantity: missing + extra }
    }),
    Array.filter(({ quantity }) => quantity > 0),
    Array.sort(byPrinting),
  )
}

export type CardTraderLine = Readonly<{
  blueprintId: CardTraderBlueprintId
  quantity: number
}>

export type CardTraderLines = Readonly<{
  lines: ReadonlyArray<CardTraderLine>
  notOnCardTrader: ReadonlyArray<PrintingId>
}>

export const cardTraderLinesOf = (
  lines: ReadonlyArray<Line>,
  find: (printingId: PrintingId) => Option.Option<Printing>,
): CardTraderLines => {
  const resolved = Array.map(lines, line => ({
    line,
    maybePrinting: find(line.printingId),
  }))
  const onCardTrader = Array.filterMap(resolved, ({ line, maybePrinting }) =>
    Option.match(
      Option.flatMap(maybePrinting, printing =>
        Option.map(printing.maybeCardTraderBlueprintId, blueprintId => ({
          key: `${printing.cardId}|${printing.set}`,
          blueprintId,
          quantity: line.quantity,
        })),
      ),
      {
        onNone: () => Result.fail(line.printingId),
        onSome: Result.succeed,
      },
    ),
  )

  return {
    lines: pipe(
      Array.groupBy(onCardTrader, ({ key }) => key),
      Record.values,
      Array.map(group => ({
        blueprintId: Array.headNonEmpty(group).blueprintId,
        quantity: Number.sumAll(Array.map(group, ({ quantity }) => quantity)),
      })),
    ),
    notOnCardTrader: Array.filterMap(resolved, ({ line, maybePrinting }) =>
      Option.exists(maybePrinting, printing =>
        Option.isSome(printing.maybeCardTraderBlueprintId),
      )
        ? Result.failVoid
        : Result.succeed(line.printingId),
    ),
  }
}

export const CARDTRADER_GAME_ID = 22

export const cardTraderCardUrl = (blueprintId: CardTraderBlueprintId): string =>
  `https://www.cardtrader.com/cards/${blueprintId}`

export const cardTraderWishlistUrl = (
  wishlistId: CardTraderWishlistId,
): string => `https://www.cardtrader.com/wishlists/${wishlistId}`
