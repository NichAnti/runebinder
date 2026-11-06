import { Array, Effect, Option, Record } from 'effect'
import { Command, type Update } from 'foldkit'
import { modifyFields } from 'foldkit/struct'

import { Wishlist } from '../../../domain'
import {
  CardTraderClient,
  CardTraderError,
  type ListedWishlist,
  TokenStore,
} from '../../../service'
import { Message } from './message'
import { Deletion, Detail, Listing, type Model, init } from './model'

type UpdateReturn = Update.Return<Model, Message, CardTraderClient | TokenStore>

// COMMAND

const storedToken = Effect.gen(function* () {
  const store = yield* TokenStore
  return yield* Option.match(yield* store.read, {
    onNone: () => Effect.fail(new CardTraderError({ reason: 'InvalidToken' })),
    onSome: ({ token }) => Effect.succeed(token),
  })
})

export const ListWishlists = Command.define('ListWishlists', {
  messages: [Message.SucceededListWishlists, Message.FailedListWishlists],
  execute: Effect.gen(function* () {
    const client = yield* CardTraderClient
    const wishlists = yield* client.listWishlists(yield* storedToken)
    return Message.SucceededListWishlists({ wishlists })
  }).pipe(
    Effect.catchTag('CardTraderError', ({ reason }) =>
      Effect.succeed(Message.FailedListWishlists({ reason })),
    ),
  ),
})

export const ShowWishlist = Command.define('ShowWishlist', {
  args: { wishlistId: Wishlist.CardTraderWishlistId },
  messages: [Message.SucceededShowWishlist, Message.FailedShowWishlist],
  execute: ({ wishlistId }) =>
    Effect.gen(function* () {
      const client = yield* CardTraderClient
      const wishlist = yield* client.showWishlist(
        yield* storedToken,
        wishlistId,
      )
      return Message.SucceededShowWishlist({ wishlist })
    }).pipe(
      Effect.catchTag('CardTraderError', ({ reason }) =>
        Effect.succeed(Message.FailedShowWishlist({ wishlistId, reason })),
      ),
    ),
})

export const DeleteWishlist = Command.define('DeleteWishlist', {
  args: { wishlistId: Wishlist.CardTraderWishlistId },
  messages: [Message.SucceededDeleteWishlist, Message.FailedDeleteWishlist],
  execute: ({ wishlistId }) =>
    Effect.gen(function* () {
      const client = yield* CardTraderClient
      yield* client.deleteWishlist(yield* storedToken, wishlistId)
      return Message.SucceededDeleteWishlist({ wishlistId })
    }).pipe(
      Effect.catchTag('CardTraderError', ({ reason }) =>
        Effect.succeed(Message.FailedDeleteWishlist({ wishlistId, reason })),
      ),
    ),
})

// ENTRY

const listing = (model: Model): UpdateReturn => ({
  model: modifyFields(model, { listing: () => Listing.Loading() }),
  commands: [ListWishlists()],
})

export const ensureListed = (model: Model): UpdateReturn =>
  model.listing._tag === 'NotLoaded' ? listing(model) : { model }

export const refresh = (model: Model): UpdateReturn =>
  model.listing._tag === 'Loading' ? { model } : listing(model)

export const ensureShown = (
  model: Model,
  wishlistId: Wishlist.CardTraderWishlistId,
): UpdateReturn =>
  Option.match(Record.get(model.details, `${wishlistId}`), {
    onNone: () => ({
      model: modifyFields(model, {
        details: details =>
          Record.set(details, `${wishlistId}`, Detail.Loading()),
      }),
      commands: [ShowWishlist({ wishlistId })],
    }),
    onSome: detail =>
      detail._tag === 'Failed'
        ? {
            model: modifyFields(model, {
              details: details =>
                Record.set(details, `${wishlistId}`, Detail.Loading()),
            }),
            commands: [ShowWishlist({ wishlistId })],
          }
        : { model },
  })

export const remove = (
  model: Model,
  wishlistId: Wishlist.CardTraderWishlistId,
): UpdateReturn =>
  Option.exists(
    Record.get(model.deletions, `${wishlistId}`),
    deletion => deletion._tag === 'Deleting',
  )
    ? { model }
    : {
        model: modifyFields(model, {
          deletions: deletions =>
            Record.set(deletions, `${wishlistId}`, Deletion.Deleting()),
        }),
        commands: [DeleteWishlist({ wishlistId })],
      }

const withListed = (
  model: Model,
  f: (
    wishlists: ReadonlyArray<ListedWishlist>,
  ) => ReadonlyArray<ListedWishlist>,
): Model =>
  modifyFields(model, {
    listing: current =>
      current._tag === 'Ready'
        ? Listing.Ready({ wishlists: f(current.wishlists) })
        : current,
  })

export const added = (model: Model, wishlist: ListedWishlist): Model =>
  withListed(model, wishlists => [
    ...Array.filter(wishlists, ({ id }) => id !== wishlist.id),
    wishlist,
  ])

export const removed = (
  model: Model,
  wishlistId: Wishlist.CardTraderWishlistId,
): Model =>
  modifyFields(
    withListed(
      model,
      Array.filter(({ id }) => id !== wishlistId),
    ),
    {
      details: details => Record.remove(details, `${wishlistId}`),
    },
  )

export const reset = (): Model => init()

// UPDATE

export const update = (model: Model, message: Message) =>
  Message.match<UpdateReturn>(message, {
    SucceededListWishlists: ({ wishlists }) => ({
      model: modifyFields(model, {
        listing: () => Listing.Ready({ wishlists }),
      }),
    }),

    FailedListWishlists: ({ reason }) => ({
      model: modifyFields(model, {
        listing: () => Listing.Failed({ reason }),
      }),
    }),

    SucceededShowWishlist: ({ wishlist }) => ({
      model: modifyFields(model, {
        details: details =>
          Record.set(details, `${wishlist.id}`, Detail.Ready({ wishlist })),
      }),
    }),

    FailedShowWishlist: ({ wishlistId, reason }) => ({
      model: modifyFields(model, {
        details: details =>
          Record.set(details, `${wishlistId}`, Detail.Failed({ reason })),
      }),
    }),

    SucceededDeleteWishlist: ({ wishlistId }) => ({
      model: modifyFields(removed(model, wishlistId), {
        deletions: deletions => Record.remove(deletions, `${wishlistId}`),
      }),
    }),

    FailedDeleteWishlist: ({ wishlistId, reason }) => ({
      model: modifyFields(model, {
        deletions: deletions =>
          Record.set(deletions, `${wishlistId}`, Deletion.Failed({ reason })),
      }),
    }),
  })

// QUERY

export const detailOf = (
  model: Model,
  wishlistId: Wishlist.CardTraderWishlistId,
): Option.Option<Detail> => Record.get(model.details, `${wishlistId}`)

export const deletionOf = (
  model: Model,
  wishlistId: Wishlist.CardTraderWishlistId,
): Option.Option<Deletion> => Record.get(model.deletions, `${wishlistId}`)

export const isRejected = (message: Message): boolean =>
  (message._tag === 'FailedListWishlists' ||
    message._tag === 'FailedShowWishlist' ||
    message._tag === 'FailedDeleteWishlist') &&
  message.reason === 'InvalidToken'
