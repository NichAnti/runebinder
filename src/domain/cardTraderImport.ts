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

import { CardId, type Printing, PrintingId, cardTraderKey } from './printing'
import { CardTraderWishlistId } from './wishlist'

export const RemoteItem = Schema.Struct({
  quantity: Schema.Int.check(Schema.isGreaterThan(0)),
  metaName: Schema.String,
  expansionCode: Schema.String,
})
export type RemoteItem = typeof RemoteItem.Type

export const RemoteWishlist = Schema.Struct({
  id: CardTraderWishlistId,
  name: Schema.String,
  items: Schema.Array(RemoteItem),
})
export type RemoteWishlist = typeof RemoteWishlist.Type

export const Match = Schema.Union([
  Schema.TaggedStruct('Matched', { cardId: CardId, printingId: PrintingId }),
  Schema.TaggedStruct('NotInCatalogue', {}),
  Schema.TaggedStruct('Ambiguous', {}),
])
export type Match = typeof Match.Type

export const ImportLine = Schema.Struct({
  key: Schema.String,
  metaName: Schema.String,
  expansionCode: Schema.String,
  quantity: Schema.Int,
  match: Match,
})
export type ImportLine = typeof ImportLine.Type

const byId = Order.mapInput(Order.String, ({ id }: Printing) => id)

const standardOf = (printings: Array.NonEmptyReadonlyArray<Printing>) => {
  const sorted = Array.sort(printings, byId)

  return Option.getOrElse(
    Array.findFirst(sorted, ({ variant }) => variant === 'Base'),
    () => Array.headNonEmpty(sorted),
  )
}

export const matchOf = (printings: ReadonlyArray<Printing>): Match =>
  Array.match(printings, {
    onEmpty: (): Match => ({ _tag: 'NotInCatalogue' }),
    onNonEmpty: found => {
      const cardIds = Array.dedupe(Array.map(found, ({ cardId }) => cardId))

      if (Array.length(cardIds) > 1) {
        return { _tag: 'Ambiguous' }
      } else {
        const standard = standardOf(found)
        return {
          _tag: 'Matched',
          cardId: standard.cardId,
          printingId: standard.id,
        }
      }
    },
  })

export const importLinesOf = (
  items: ReadonlyArray<RemoteItem>,
  printingsFor: (key: string) => ReadonlyArray<Printing>,
): ReadonlyArray<ImportLine> =>
  pipe(
    Array.groupBy(items, cardTraderKey),
    Record.toEntries,
    Array.map(([key, group]): ImportLine => {
      const { metaName, expansionCode } = Array.headNonEmpty(group)

      return {
        key,
        metaName,
        expansionCode,
        quantity: Number.sumAll(Array.map(group, ({ quantity }) => quantity)),
        match: matchOf(printingsFor(key)),
      }
    }),
    Array.sort(Order.mapInput(Order.String, ({ key }: ImportLine) => key)),
  )

export type Imported = Readonly<{ printingId: PrintingId; quantity: number }>

export const isImportable = ({ match }: ImportLine): boolean =>
  match._tag === 'Matched'

export const importedOf = (
  lines: ReadonlyArray<ImportLine>,
): ReadonlyArray<Imported> =>
  pipe(
    Array.filterMap(lines, ({ match, quantity }) =>
      match._tag === 'Matched'
        ? Result.succeed({ printingId: match.printingId, quantity })
        : Result.failVoid,
    ),
    Array.groupBy(({ printingId }) => printingId),
    Record.toEntries,
    Array.map(([, group]) => ({
      printingId: Array.headNonEmpty(group).printingId,
      quantity: Number.sumAll(Array.map(group, ({ quantity }) => quantity)),
    })),
  )
