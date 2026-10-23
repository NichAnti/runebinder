import { Array, Option } from 'effect'

import {
  type Collection,
  type Deck,
  Missing,
  type Printing,
  Wishlist,
} from '../../../../domain'

export type Context = Readonly<{
  decks: ReadonlyArray<Deck.Deck>
  owned: Collection.Owned
  added: Collection.Owned
}>

export type Section = Readonly<{
  key: string
  title: string
  wishlist: Wishlist.WishlistRef
  isCustom: boolean
  lines: ReadonlyArray<Wishlist.Line>
}>

export const lineKeyOf = (
  section: Section,
  printingId: Printing.PrintingId,
): string => `${section.key}|${printingId}`

export const sectionsOf = ({
  decks,
  owned,
  added,
}: Context): ReadonlyArray<Section> => [
  ...Array.map(decks, (deck): Section => ({
    key: deck.id,
    title: deck.name,
    wishlist: Wishlist.deckWishlist(deck.id),
    isCustom: false,
    lines: Wishlist.linesOf(Missing.needs([deck], owned), {}),
  })),
  {
    key: Wishlist.refKey(Wishlist.CUSTOM),
    title: 'Custom wishlist',
    wishlist: Wishlist.CUSTOM,
    isCustom: true,
    lines: Wishlist.linesOf([], added),
  },
]

export const sectionOf = (
  context: Context,
  wishlist: Wishlist.WishlistRef,
): Option.Option<Section> =>
  Array.findFirst(
    sectionsOf(context),
    ({ key }) => key === Wishlist.refKey(wishlist),
  )

export const cardTraderNameOf = (section: Section): string =>
  Wishlist.cardTraderNameOf(section.wishlist, section.title)

export const printingIdsOf = (
  context: Context,
): ReadonlyArray<Printing.PrintingId> =>
  Array.dedupe(
    Array.flatMap(sectionsOf(context), ({ lines }) =>
      Array.map(lines, ({ printingId }) => printingId),
    ),
  )
