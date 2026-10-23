import { Array } from 'effect'

import {
  type Collection,
  type Deck,
  Missing,
  type Printing,
  Wishlist,
} from '../../../../domain'
import * as WishlistState from '../../wishlist'

export type Context = Readonly<{
  decks: ReadonlyArray<Deck.Deck>
  owned: Collection.Owned
  added: Collection.Owned
}>

export type Section = Readonly<{
  key: string
  title: string
  target: WishlistState.SendTarget
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
    target: { _tag: 'Deck', deckId: deck.id, deckName: deck.name },
    isCustom: false,
    lines: Wishlist.linesOf(Missing.needs([deck], owned), {}),
  })),
  {
    key: WishlistState.CUSTOM_KEY,
    title: 'Custom wishlist',
    target: { _tag: 'Custom' },
    isCustom: true,
    lines: Wishlist.linesOf([], added),
  },
]

export const printingIdsOf = (
  context: Context,
): ReadonlyArray<Printing.PrintingId> =>
  Array.dedupe(
    Array.flatMap(sectionsOf(context), ({ lines }) =>
      Array.map(lines, ({ printingId }) => printingId),
    ),
  )
