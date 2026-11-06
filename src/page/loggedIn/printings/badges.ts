import { Array, Option, pipe } from 'effect'

import { Collection, type Printing, Wishlist } from '../../../domain'

export const badgesOf = (
  maybeOwned: Option.Option<Collection.Owned>,
  maybeWanted: Option.Option<Wishlist.Wanted>,
  printingIds: ReadonlyArray<Printing.PrintingId>,
): ReadonlyArray<string> =>
  Array.getSomes([
    pipe(
      maybeOwned,
      Option.map(owned => Collection.totalOf(owned, printingIds)),
      Option.filter(total => total > 0),
      Option.map(total => `Owned ${total}`),
    ),
    pipe(
      maybeWanted,
      Option.map(wanted => Wishlist.wantedCopiesOf(wanted, printingIds)),
      Option.filter(total => total > 0),
      Option.map(total => `Need ${total}`),
    ),
  ])
