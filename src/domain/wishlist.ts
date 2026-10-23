import {
  Array,
  Number,
  Option,
  Order,
  Record,
  Result,
  Schema,
  String,
  pipe,
} from 'effect'

import { type Owned, OwnedQuantity, quantityOf } from './collection'
import { type Deck, DeckId } from './deck'
import { type Need, needs } from './missing'
import {
  CardTraderBlueprintId,
  type Printing,
  PrintingId,
  cardTraderKey,
} from './printing'

export const CardTraderWishlistId = Schema.Int.check(
  Schema.isGreaterThan(0),
).pipe(Schema.brand('CardTraderWishlistId'))
export type CardTraderWishlistId = typeof CardTraderWishlistId.Type

export const WishlistItem = Schema.Struct({
  printingId: PrintingId,
  quantity: OwnedQuantity,
})
export type WishlistItem = typeof WishlistItem.Type

export const WishlistRef = Schema.Union([
  Schema.TaggedStruct('Custom', {}),
  Schema.TaggedStruct('Deck', { deckId: DeckId }),
])
export type WishlistRef = typeof WishlistRef.Type

export const CUSTOM: WishlistRef = { _tag: 'Custom' }

export const deckWishlist = (deckId: DeckId): WishlistRef => ({
  _tag: 'Deck',
  deckId,
})

const CUSTOM_KEY = 'custom'

export const refKey = (ref: WishlistRef): string =>
  ref._tag === 'Custom' ? CUSTOM_KEY : ref.deckId

export const CardTraderLink = Schema.Struct({
  wishlist: WishlistRef,
  cardTraderWishlistId: CardTraderWishlistId,
})
export type CardTraderLink = typeof CardTraderLink.Type

export const Wishlist = Schema.Struct({
  items: Schema.Array(WishlistItem),
  cardTraderLinks: Schema.Array(CardTraderLink),
})
export type Wishlist = typeof Wishlist.Type

const APP_NAME_SUFFIX = ' (cardtrader app)'

export const cardTraderNameOf = (ref: WishlistRef, deckName: string): string =>
  ref._tag === 'Custom'
    ? `Custom wishlist${APP_NAME_SUFFIX}`
    : `${deckName}${APP_NAME_SUFFIX}`

export const isNamedByApp: (name: string) => boolean =
  String.endsWith(APP_NAME_SUFFIX)

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

export type Wanted = Readonly<{
  copies: Readonly<Record<PrintingId, number>>
  fromDecks: number
  fromCustom: number
}>

export const wantedOf = (
  decks: ReadonlyArray<Deck>,
  owned: Owned,
  added: Owned,
): Wanted => {
  const lines = linesOf(needs(decks, owned), added)

  return {
    copies: Record.fromEntries(
      Array.map(
        lines,
        ({ printingId, quantity }): readonly [PrintingId, number] => [
          printingId,
          quantity,
        ],
      ),
    ),
    fromDecks: Number.sumAll(Array.map(lines, ({ missing }) => missing)),
    fromCustom: Number.sumAll(Array.map(lines, ({ added }) => added)),
  }
}

export const wantedCopiesOf = (
  wanted: Wanted,
  printingIds: ReadonlyArray<PrintingId>,
): number =>
  Number.sumAll(
    Array.map(printingIds, printingId =>
      Option.getOrElse(Record.get(wanted.copies, printingId), () => 0),
    ),
  )

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
        Option.map(printing.maybeCardTrader, blueprint => ({
          key: cardTraderKey(blueprint),
          blueprintId: blueprint.id,
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
        Option.isSome(printing.maybeCardTrader),
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
