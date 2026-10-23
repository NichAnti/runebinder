import { RuntimeContext } from 'alchemy'
import * as Drizzle from 'alchemy/Drizzle'
import { and, desc, eq } from 'drizzle-orm'
import { type DrizzleD1Database, drizzle } from 'drizzle-orm/d1'
import {
  Array,
  Clock,
  Context,
  Crypto,
  Effect,
  HashMap,
  Layer,
  Option,
  Ref,
  Result,
  Schema,
} from 'effect'

import { type DeckInput, DeckNotFound } from '../../api'
import { Deck, type User } from '../../domain'
import { AppDatabase } from '../database'
import { deck, deckAdditionalLegend, deckCard } from '../schema'
import {
  AdditionalLegendRow,
  DeckCardRow,
  DeckRow,
  cardRowsOf,
  legendColumns,
  legendRowsOf,
  toDecks,
} from './rows'

const decodeDecks = Schema.decodeUnknownEffect(Schema.Array(DeckRow))
const decodeCards = Schema.decodeUnknownEffect(Schema.Array(DeckCardRow))
const decodeLegends = Schema.decodeUnknownEffect(
  Schema.Array(AdditionalLegendRow),
)

export class DeckRepository extends Context.Service<
  DeckRepository,
  {
    readonly list: (
      userId: User.UserId,
    ) => Effect.Effect<ReadonlyArray<Deck.Deck>>
    readonly create: (
      userId: User.UserId,
      input: DeckInput,
    ) => Effect.Effect<Deck.Deck>
    readonly replace: (
      userId: User.UserId,
      deckId: Deck.DeckId,
      input: DeckInput,
    ) => Effect.Effect<void, DeckNotFound>
    readonly remove: (
      userId: User.UserId,
      deckId: Deck.DeckId,
    ) => Effect.Effect<void, DeckNotFound>
  }
>()('cardtrader/worker/DeckRepository') {
  static readonly layer = Layer.effect(
    DeckRepository,
    Effect.gen(function* () {
      const database = yield* AppDatabase
      const db = yield* Drizzle.D1(database)
      const crypto = yield* Crypto.Crypto

      const writeAtomically = (
        statements: (
          writer: DrizzleD1Database,
        ) => Parameters<DrizzleD1Database['batch']>[0],
      ) =>
        database.raw.pipe(
          Effect.flatMap(binding =>
            Effect.tryPromise(() => {
              const writer = drizzle(binding)
              return writer.batch(statements(writer))
            }),
          ),
          Effect.orDie,
        )

      const contentStatements = (
        writer: DrizzleD1Database,
        deckId: Deck.DeckId,
        contents: Deck.DeckContents,
      ) => {
        const cards = cardRowsOf(deckId, contents)
        const legends = legendRowsOf(deckId, contents)

        return [
          ...(Array.isReadonlyArrayNonEmpty(cards)
            ? [writer.insert(deckCard).values(Array.fromIterable(cards))]
            : []),
          ...(Array.isReadonlyArrayNonEmpty(legends)
            ? [
                writer
                  .insert(deckAdditionalLegend)
                  .values(Array.fromIterable(legends)),
              ]
            : []),
        ]
      }

      const isOwned = (userId: User.UserId, deckId: Deck.DeckId) =>
        and(eq(deck.id, deckId), eq(deck.userId, userId))

      const exists = (userId: User.UserId, deckId: Deck.DeckId) =>
        db
          .select({ id: deck.id })
          .from(deck)
          .where(isOwned(userId, deckId))
          .limit(1)
          .pipe(Effect.map(Array.isReadonlyArrayNonEmpty))

      const list = Effect.fn('DeckRepository.list')(
        function* (userId: User.UserId) {
          const decks = yield* db
            .select()
            .from(deck)
            .where(eq(deck.userId, userId))
            .orderBy(desc(deck.updatedAt))
          const cards = yield* db
            .select({
              deckId: deckCard.deckId,
              zone: deckCard.zone,
              printingId: deckCard.printingId,
              copies: deckCard.copies,
            })
            .from(deckCard)
            .innerJoin(deck, eq(deck.id, deckCard.deckId))
            .where(eq(deck.userId, userId))
          const legends = yield* db
            .select({
              deckId: deckAdditionalLegend.deckId,
              position: deckAdditionalLegend.position,
              printingId: deckAdditionalLegend.printingId,
            })
            .from(deckAdditionalLegend)
            .innerJoin(deck, eq(deck.id, deckAdditionalLegend.deckId))
            .where(eq(deck.userId, userId))

          return toDecks(
            yield* decodeDecks(decks),
            yield* decodeCards(cards),
            yield* decodeLegends(legends),
          )
        },
        Effect.orDie,
        Effect.provide(RuntimeContext.phantom),
      )

      const create = Effect.fn('DeckRepository.create')(
        function* (userId: User.UserId, { name, contents }: DeckInput) {
          const deckId = yield* crypto.randomUUIDv4.pipe(
            Effect.flatMap(Schema.decodeEffect(Deck.DeckId)),
          )
          const now = new Date(yield* Clock.currentTimeMillis)

          yield* writeAtomically(writer => [
            writer.insert(deck).values({
              id: deckId,
              userId,
              name,
              ...legendColumns(contents),
              createdAt: now,
              updatedAt: now,
            }),
            ...contentStatements(writer, deckId, contents),
          ])

          return { id: deckId, name, contents }
        },
        Effect.orDie,
        Effect.provide(RuntimeContext.phantom),
      )

      const replace = Effect.fn('DeckRepository.replace')(function* (
        userId: User.UserId,
        deckId: Deck.DeckId,
        { name, contents }: DeckInput,
      ) {
        if (!(yield* exists(userId, deckId).pipe(Effect.orDie))) {
          return yield* new DeckNotFound({ deckId })
        }

        const now = new Date(yield* Clock.currentTimeMillis)

        yield* writeAtomically(writer => [
          writer
            .update(deck)
            .set({ name, ...legendColumns(contents), updatedAt: now })
            .where(isOwned(userId, deckId)),
          writer.delete(deckCard).where(eq(deckCard.deckId, deckId)),
          writer
            .delete(deckAdditionalLegend)
            .where(eq(deckAdditionalLegend.deckId, deckId)),
          ...contentStatements(writer, deckId, contents),
        ])
      }, Effect.provide(RuntimeContext.phantom))

      const remove = Effect.fn('DeckRepository.remove')(function* (
        userId: User.UserId,
        deckId: Deck.DeckId,
      ) {
        const removed = yield* db
          .delete(deck)
          .where(isOwned(userId, deckId))
          .returning({ id: deck.id })
          .pipe(Effect.orDie)

        if (Array.isReadonlyArrayEmpty(removed)) {
          return yield* new DeckNotFound({ deckId })
        }
      }, Effect.provide(RuntimeContext.phantom))

      return DeckRepository.of({ list, create, replace, remove })
    }),
  )

  static readonly layerMemory = Layer.effect(
    DeckRepository,
    Effect.gen(function* () {
      const decks = yield* Ref.make(
        HashMap.empty<
          Deck.DeckId,
          Readonly<{ userId: User.UserId; deck: Deck.Deck }>
        >(),
      )
      const crypto = yield* Crypto.Crypto

      const owned = (userId: User.UserId, deckId: Deck.DeckId) =>
        Ref.get(decks).pipe(
          Effect.map(all =>
            Option.filter(
              HashMap.get(all, deckId),
              entry => entry.userId === userId,
            ),
          ),
        )

      return DeckRepository.of({
        list: userId =>
          Ref.get(decks).pipe(
            Effect.map(all =>
              Array.filterMap(Array.fromIterable(HashMap.values(all)), entry =>
                entry.userId === userId
                  ? Result.succeed(entry.deck)
                  : Result.failVoid,
              ),
            ),
          ),
        create: (userId, { name, contents }) =>
          Effect.gen(function* () {
            const id = yield* crypto.randomUUIDv4.pipe(
              Effect.flatMap(Schema.decodeEffect(Deck.DeckId)),
              Effect.orDie,
            )
            const created = { id, name, contents }
            yield* Ref.update(decks, HashMap.set(id, { userId, deck: created }))
            return created
          }),
        replace: (userId, deckId, { name, contents }) =>
          Effect.gen(function* () {
            if (Option.isNone(yield* owned(userId, deckId))) {
              return yield* new DeckNotFound({ deckId })
            }

            yield* Ref.update(
              decks,
              HashMap.set(deckId, {
                userId,
                deck: { id: deckId, name, contents },
              }),
            )
          }),
        remove: (userId, deckId) =>
          Effect.gen(function* () {
            if (Option.isNone(yield* owned(userId, deckId))) {
              return yield* new DeckNotFound({ deckId })
            }

            yield* Ref.update(decks, HashMap.remove(deckId))
          }),
      })
    }),
  )
}
