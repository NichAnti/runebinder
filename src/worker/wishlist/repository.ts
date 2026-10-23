import { RuntimeContext } from 'alchemy'
import * as Drizzle from 'alchemy/Drizzle'
import { and, eq } from 'drizzle-orm'
import { createSelectSchema } from 'drizzle-orm/effect-schema'
import {
  Array,
  Context,
  Effect,
  HashMap,
  HashSet,
  Layer,
  Option,
  Record,
  Ref,
  Schema,
} from 'effect'

import { DeckNotFound } from '../../api'
import { Collection, Deck, Printing, User, Wishlist } from '../../domain'
import { AppDatabase } from '../database'
import {
  cardTraderWishlist,
  deck,
  deckCardTraderWishlist,
  wishlistItem,
} from '../schema'

const WishlistItemRow = createSelectSchema(wishlistItem, {
  userId: User.UserId,
  printingId: Printing.PrintingId,
  quantity: Collection.OwnedQuantity,
})
const CustomLinkRow = createSelectSchema(cardTraderWishlist, {
  userId: User.UserId,
  wishlistId: Wishlist.CardTraderWishlistId,
})
const DeckLinkRow = createSelectSchema(deckCardTraderWishlist, {
  deckId: Deck.DeckId,
  wishlistId: Wishlist.CardTraderWishlistId,
})

const decodeItems = Schema.decodeUnknownEffect(Schema.Array(WishlistItemRow))
const decodeCustomLinks = Schema.decodeUnknownEffect(
  Schema.Array(CustomLinkRow),
)
const decodeDeckLinks = Schema.decodeUnknownEffect(Schema.Array(DeckLinkRow))

export class WishlistRepository extends Context.Service<
  WishlistRepository,
  {
    readonly show: (userId: User.UserId) => Effect.Effect<Wishlist.Wishlist>
    readonly setItem: (
      userId: User.UserId,
      printingId: Printing.PrintingId,
      quantity: Collection.Quantity,
    ) => Effect.Effect<void>
    readonly linkCustom: (
      userId: User.UserId,
      cardTraderWishlistId: Wishlist.CardTraderWishlistId,
    ) => Effect.Effect<void>
    readonly unlinkCustom: (userId: User.UserId) => Effect.Effect<void>
    readonly linkDeck: (
      userId: User.UserId,
      deckId: Deck.DeckId,
      cardTraderWishlistId: Wishlist.CardTraderWishlistId,
    ) => Effect.Effect<void, DeckNotFound>
    readonly unlinkDeck: (
      userId: User.UserId,
      deckId: Deck.DeckId,
    ) => Effect.Effect<void, DeckNotFound>
  }
>()('cardtrader/worker/WishlistRepository') {
  static readonly layer = Layer.effect(
    WishlistRepository,
    Effect.gen(function* () {
      const db = yield* Drizzle.D1(yield* AppDatabase)

      const show = Effect.fn('WishlistRepository.show')(
        function* (userId: User.UserId) {
          const items = yield* db
            .select()
            .from(wishlistItem)
            .where(eq(wishlistItem.userId, userId))
            .pipe(Effect.flatMap(decodeItems))
          const customLinks = yield* db
            .select()
            .from(cardTraderWishlist)
            .where(eq(cardTraderWishlist.userId, userId))
            .pipe(Effect.flatMap(decodeCustomLinks))
          const deckLinks = yield* db
            .select({
              deckId: deckCardTraderWishlist.deckId,
              wishlistId: deckCardTraderWishlist.wishlistId,
            })
            .from(deckCardTraderWishlist)
            .innerJoin(deck, eq(deck.id, deckCardTraderWishlist.deckId))
            .where(eq(deck.userId, userId))
            .pipe(Effect.flatMap(decodeDeckLinks))

          return {
            items: Array.map(items, ({ printingId, quantity }) => ({
              printingId,
              quantity,
            })),
            cardTraderLinks: [
              ...Array.map(
                customLinks,
                ({ wishlistId }): Wishlist.CardTraderLink => ({
                  wishlist: Wishlist.CUSTOM,
                  cardTraderWishlistId: wishlistId,
                }),
              ),
              ...Array.map(
                deckLinks,
                ({ deckId, wishlistId }): Wishlist.CardTraderLink => ({
                  wishlist: Wishlist.deckWishlist(deckId),
                  cardTraderWishlistId: wishlistId,
                }),
              ),
            ],
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

      const ownedDeck = (userId: User.UserId, deckId: Deck.DeckId) =>
        db
          .select({ id: deck.id })
          .from(deck)
          .where(and(eq(deck.id, deckId), eq(deck.userId, userId)))
          .limit(1)
          .pipe(
            Effect.orDie,
            Effect.flatMap(rows =>
              Array.isReadonlyArrayNonEmpty(rows)
                ? Effect.void
                : Effect.fail(new DeckNotFound({ deckId })),
            ),
          )

      const linkCustom = Effect.fn('WishlistRepository.linkCustom')(
        function* (
          userId: User.UserId,
          wishlistId: Wishlist.CardTraderWishlistId,
        ) {
          yield* db
            .insert(cardTraderWishlist)
            .values({ userId, wishlistId })
            .onConflictDoUpdate({
              target: cardTraderWishlist.userId,
              set: { wishlistId },
            })
        },
        Effect.orDie,
        Effect.provide(RuntimeContext.phantom),
      )

      const unlinkCustom = Effect.fn('WishlistRepository.unlinkCustom')(
        function* (userId: User.UserId) {
          yield* db
            .delete(cardTraderWishlist)
            .where(eq(cardTraderWishlist.userId, userId))
        },
        Effect.orDie,
        Effect.provide(RuntimeContext.phantom),
      )

      const linkDeck = Effect.fn('WishlistRepository.linkDeck')(function* (
        userId: User.UserId,
        deckId: Deck.DeckId,
        wishlistId: Wishlist.CardTraderWishlistId,
      ) {
        yield* ownedDeck(userId, deckId)
        yield* db
          .insert(deckCardTraderWishlist)
          .values({ deckId, wishlistId })
          .onConflictDoUpdate({
            target: deckCardTraderWishlist.deckId,
            set: { wishlistId },
          })
          .pipe(Effect.orDie)
      }, Effect.provide(RuntimeContext.phantom))

      const unlinkDeck = Effect.fn('WishlistRepository.unlinkDeck')(function* (
        userId: User.UserId,
        deckId: Deck.DeckId,
      ) {
        yield* ownedDeck(userId, deckId)
        yield* db
          .delete(deckCardTraderWishlist)
          .where(eq(deckCardTraderWishlist.deckId, deckId))
          .pipe(Effect.orDie)
      }, Effect.provide(RuntimeContext.phantom))

      return WishlistRepository.of({
        show,
        setItem,
        linkCustom,
        unlinkCustom,
        linkDeck,
        unlinkDeck,
      })
    }),
  )

  static readonly layerMemoryWith = (
    decks: ReadonlyArray<readonly [User.UserId, Deck.DeckId]>,
  ) =>
    Layer.effect(
      WishlistRepository,
      Effect.gen(function* () {
        const owned = HashSet.fromIterable(
          Array.map(decks, ([userId, deckId]) => `${userId}|${deckId}`),
        )
        const items = yield* Ref.make(
          HashMap.empty<User.UserId, Collection.Owned>(),
        )
        const links = yield* Ref.make(
          HashMap.empty<
            User.UserId,
            Record.ReadonlyRecord<string, Wishlist.CardTraderLink>
          >(),
        )

        const itemsOf = (
          all: HashMap.HashMap<User.UserId, Collection.Owned>,
          userId: User.UserId,
        ) =>
          Option.getOrElse(
            HashMap.get(all, userId),
            (): Collection.Owned => ({}),
          )

        const linksOf = (
          all: HashMap.HashMap<
            User.UserId,
            Record.ReadonlyRecord<string, Wishlist.CardTraderLink>
          >,
          userId: User.UserId,
        ) =>
          Option.getOrElse(
            HashMap.get(all, userId),
            (): Record.ReadonlyRecord<string, Wishlist.CardTraderLink> => ({}),
          )

        const checkOwned = (userId: User.UserId, deckId: Deck.DeckId) =>
          HashSet.has(owned, `${userId}|${deckId}`)
            ? Effect.void
            : Effect.fail(new DeckNotFound({ deckId }))

        const setLink = (
          userId: User.UserId,
          wishlist: Wishlist.WishlistRef,
          cardTraderWishlistId: Wishlist.CardTraderWishlistId,
        ) =>
          Ref.update(links, all =>
            HashMap.set(
              all,
              userId,
              Record.set(linksOf(all, userId), Wishlist.refKey(wishlist), {
                wishlist,
                cardTraderWishlistId,
              }),
            ),
          )

        const clearLink = (
          userId: User.UserId,
          wishlist: Wishlist.WishlistRef,
        ) =>
          Ref.update(links, all =>
            HashMap.set(
              all,
              userId,
              Record.remove(linksOf(all, userId), Wishlist.refKey(wishlist)),
            ),
          )

        return WishlistRepository.of({
          show: userId =>
            Effect.gen(function* () {
              const added = itemsOf(yield* Ref.get(items), userId)
              return {
                items: Array.map(
                  Record.toEntries(added),
                  ([printingId, quantity]) => ({ printingId, quantity }),
                ),
                cardTraderLinks: Record.values(
                  linksOf(yield* Ref.get(links), userId),
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
          linkCustom: (userId, cardTraderWishlistId) =>
            setLink(userId, Wishlist.CUSTOM, cardTraderWishlistId),
          unlinkCustom: userId => clearLink(userId, Wishlist.CUSTOM),
          linkDeck: (userId, deckId, cardTraderWishlistId) =>
            checkOwned(userId, deckId).pipe(
              Effect.andThen(
                setLink(
                  userId,
                  Wishlist.deckWishlist(deckId),
                  cardTraderWishlistId,
                ),
              ),
            ),
          unlinkDeck: (userId, deckId) =>
            checkOwned(userId, deckId).pipe(
              Effect.andThen(clearLink(userId, Wishlist.deckWishlist(deckId))),
            ),
        })
      }),
    )

  static readonly layerMemory = WishlistRepository.layerMemoryWith([])
}
