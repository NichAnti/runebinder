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
  Ref,
  Schema,
} from 'effect'

import { Collection, Printing, User } from '../../domain'
import { AppDatabase } from '../database'
import { collectionItem } from '../schema'

const CollectionItemRow = createSelectSchema(collectionItem, {
  userId: User.UserId,
  printingId: Printing.PrintingId,
  quantity: Collection.OwnedQuantity,
})

const decodeRows = Schema.decodeUnknownEffect(Schema.Array(CollectionItemRow))

export class CollectionRepository extends Context.Service<
  CollectionRepository,
  {
    readonly list: (
      userId: User.UserId,
    ) => Effect.Effect<ReadonlyArray<Collection.CollectionItem>>
    readonly set: (
      userId: User.UserId,
      printingId: Printing.PrintingId,
      quantity: Collection.Quantity,
    ) => Effect.Effect<void>
  }
>()('runebinder/worker/CollectionRepository') {
  static readonly layer = Layer.effect(
    CollectionRepository,
    Effect.gen(function* () {
      const db = yield* Drizzle.D1(yield* AppDatabase)

      const list = Effect.fn('CollectionRepository.list')(
        function* (userId: User.UserId) {
          const rows = yield* db
            .select()
            .from(collectionItem)
            .where(eq(collectionItem.userId, userId))
          const items = yield* decodeRows(rows)
          return Array.map(items, ({ printingId, quantity }) => ({
            printingId,
            quantity,
          }))
        },
        Effect.orDie,
        Effect.provide(RuntimeContext.phantom),
      )

      const set = Effect.fn('CollectionRepository.set')(
        function* (
          userId: User.UserId,
          printingId: Printing.PrintingId,
          quantity: Collection.Quantity,
        ) {
          yield* Option.match(Collection.toOwned(quantity), {
            onNone: () =>
              db
                .delete(collectionItem)
                .where(
                  and(
                    eq(collectionItem.userId, userId),
                    eq(collectionItem.printingId, printingId),
                  ),
                ),
            onSome: owned =>
              db
                .insert(collectionItem)
                .values({ userId, printingId, quantity: owned })
                .onConflictDoUpdate({
                  target: [collectionItem.userId, collectionItem.printingId],
                  set: { quantity: owned },
                }),
          })
        },
        Effect.orDie,
        Effect.provide(RuntimeContext.phantom),
      )

      return CollectionRepository.of({ list, set })
    }),
  )

  static readonly layerMemory = Layer.effect(
    CollectionRepository,
    Effect.gen(function* () {
      const owners = yield* Ref.make(
        HashMap.empty<
          User.UserId,
          HashMap.HashMap<Printing.PrintingId, Collection.OwnedQuantity>
        >(),
      )

      const itemsOf = (
        all: HashMap.HashMap<
          User.UserId,
          HashMap.HashMap<Printing.PrintingId, Collection.OwnedQuantity>
        >,
        userId: User.UserId,
      ) => Option.getOrElse(HashMap.get(all, userId), () => HashMap.empty())

      return CollectionRepository.of({
        list: userId =>
          Ref.get(owners).pipe(
            Effect.map(all =>
              Array.map(
                Array.fromIterable(itemsOf(all, userId)),
                ([printingId, quantity]) => ({ printingId, quantity }),
              ),
            ),
          ),
        set: (userId, printingId, quantity) =>
          Ref.update(owners, all =>
            HashMap.set(
              all,
              userId,
              Option.match(Collection.toOwned(quantity), {
                onNone: () => HashMap.remove(itemsOf(all, userId), printingId),
                onSome: owned =>
                  HashMap.set(itemsOf(all, userId), printingId, owned),
              }),
            ),
          ),
      })
    }),
  )
}
