import { RuntimeContext } from 'alchemy'
import * as Drizzle from 'alchemy/Drizzle'
import { and, eq } from 'drizzle-orm'
import { createSelectSchema } from 'drizzle-orm/effect-schema'
import {
  Array,
  Context,
  Effect,
  HashMap,
  Layer,
  Option,
  Record,
  Ref,
  Schema,
} from 'effect'

import { Collection, Printing, User, Wishlist } from '../../domain'
import { AppDatabase } from '../database'
import { cardTraderWishlist, wishlistItem } from '../schema'

const WishlistItemRow = createSelectSchema(wishlistItem, {
  userId: User.UserId,
  printingId: Printing.PrintingId,
  quantity: Collection.OwnedQuantity,
})
const CardTraderWishlistRow = createSelectSchema(cardTraderWishlist, {
  userId: User.UserId,
  wishlistId: Wishlist.CardTraderWishlistId,
})

const decodeItems = Schema.decodeUnknownEffect(Schema.Array(WishlistItemRow))
const decodeSent = Schema.decodeUnknownEffect(
  Schema.Array(CardTraderWishlistRow),
)

export class WishlistRepository extends Context.Service<
  WishlistRepository,
  {
    readonly show: (userId: User.UserId) => Effect.Effect<Wishlist.Wishlist>
    readonly setItem: (
      userId: User.UserId,
      printingId: Printing.PrintingId,
      quantity: Collection.Quantity,
    ) => Effect.Effect<void>
    readonly replaceCardTraderWishlist: (
      userId: User.UserId,
      wishlistId: Wishlist.CardTraderWishlistId,
    ) => Effect.Effect<Option.Option<Wishlist.CardTraderWishlistId>>
  }
>()('cardtrader/worker/WishlistRepository') {
  static readonly layer = Layer.effect(
    WishlistRepository,
    Effect.gen(function* () {
      const db = yield* Drizzle.D1(yield* AppDatabase)

      const sentWishlistOf = (userId: User.UserId) =>
        db
          .select()
          .from(cardTraderWishlist)
          .where(eq(cardTraderWishlist.userId, userId))
          .pipe(
            Effect.flatMap(decodeSent),
            Effect.map(rows =>
              Option.map(Array.head(rows), ({ wishlistId }) => wishlistId),
            ),
          )

      const show = Effect.fn('WishlistRepository.show')(
        function* (userId: User.UserId) {
          const items = yield* db
            .select()
            .from(wishlistItem)
            .where(eq(wishlistItem.userId, userId))
            .pipe(Effect.flatMap(decodeItems))

          return {
            items: Array.map(items, ({ printingId, quantity }) => ({
              printingId,
              quantity,
            })),
            maybeCardTraderWishlistId: yield* sentWishlistOf(userId),
          }
        },
        Effect.orDie,
        Effect.provide(RuntimeContext.phantom),
      )

      const setItem = Effect.fn('WishlistRepository.setItem')(
        function* (
          userId: User.UserId,
          printingId: Printing.PrintingId,
          quantity: Collection.Quantity,
        ) {
          yield* Option.match(Collection.toOwned(quantity), {
            onNone: () =>
              db
                .delete(wishlistItem)
                .where(
                  and(
                    eq(wishlistItem.userId, userId),
                    eq(wishlistItem.printingId, printingId),
                  ),
                ),
            onSome: owned =>
              db
                .insert(wishlistItem)
                .values({ userId, printingId, quantity: owned })
                .onConflictDoUpdate({
                  target: [wishlistItem.userId, wishlistItem.printingId],
                  set: { quantity: owned },
                }),
          })
        },
        Effect.orDie,
        Effect.provide(RuntimeContext.phantom),
      )

      const replaceCardTraderWishlist = Effect.fn(
        'WishlistRepository.replaceCardTraderWishlist',
      )(
        function* (
          userId: User.UserId,
          wishlistId: Wishlist.CardTraderWishlistId,
        ) {
          const previous = yield* sentWishlistOf(userId)

          yield* db
            .insert(cardTraderWishlist)
            .values({ userId, wishlistId })
            .onConflictDoUpdate({
              target: cardTraderWishlist.userId,
              set: { wishlistId },
            })

          return Option.filter(previous, id => id !== wishlistId)
        },
        Effect.orDie,
        Effect.provide(RuntimeContext.phantom),
      )

      return WishlistRepository.of({ show, setItem, replaceCardTraderWishlist })
    }),
  )

  static readonly layerMemory = Layer.effect(
    WishlistRepository,
    Effect.gen(function* () {
      const items = yield* Ref.make(
        HashMap.empty<User.UserId, Collection.Owned>(),
      )
      const sent = yield* Ref.make(
        HashMap.empty<User.UserId, Wishlist.CardTraderWishlistId>(),
      )

      const itemsOf = (
        all: HashMap.HashMap<User.UserId, Collection.Owned>,
        userId: User.UserId,
      ) =>
        Option.getOrElse(HashMap.get(all, userId), (): Collection.Owned => ({}))

      return WishlistRepository.of({
        show: userId =>
          Effect.gen(function* () {
            const owned = itemsOf(yield* Ref.get(items), userId)
            return {
              items: Array.map(
                Record.toEntries(owned),
                ([printingId, quantity]) => ({ printingId, quantity }),
              ),
              maybeCardTraderWishlistId: HashMap.get(
                yield* Ref.get(sent),
                userId,
              ),
            }
          }),
        setItem: (userId, printingId, quantity) =>
          Ref.update(items, all =>
            HashMap.set(
              all,
              userId,
              Collection.withQuantity(
                itemsOf(all, userId),
                printingId,
                quantity,
              ),
            ),
          ),
        replaceCardTraderWishlist: (userId, wishlistId) =>
          Effect.gen(function* () {
            const previous = HashMap.get(yield* Ref.get(sent), userId)
            yield* Ref.update(sent, HashMap.set(userId, wishlistId))
            return Option.filter(previous, id => id !== wishlistId)
          }),
      })
    }),
  )
}
