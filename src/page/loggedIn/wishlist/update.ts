import { Array, Duration, Effect, Option, Record, Result, Schema } from 'effect'
import { Command, type Update } from 'foldkit'
import { modifyFields } from 'foldkit/struct'

import { Collection, Printing, Wishlist } from '../../../domain'
import { ApiClient, CardTraderClient, TokenStore } from '../../../service'
import { Message } from './message'
import {
  Model,
  type Ready,
  Save,
  type SendFailure,
  SendTarget,
  Sending,
  targetKey,
  wishlistNameOf,
} from './model'

type UpdateReturn = Update.Return<
  Model,
  Message,
  ApiClient | CardTraderClient | TokenStore
>

const SAVE_DELAY = Duration.millis(600)

// COMMAND

export const LoadWishlist = Command.define('LoadWishlist', {
  messages: [Message.SucceededLoadWishlist, Message.FailedLoadWishlist],
  execute: Effect.gen(function* () {
    const api = yield* ApiClient
    const wishlist = yield* api.wishlist.show()
    return Message.SucceededLoadWishlist({ wishlist })
  }).pipe(Effect.catch(() => Effect.succeed(Message.FailedLoadWishlist()))),
})

export const WaitToSaveItem = Command.define('WaitToSaveItem', {
  args: { printingId: Printing.PrintingId, revision: Schema.Int },
  messages: [Message.ElapsedSaveItemDelay],
  execute: ({ printingId, revision }) =>
    Effect.sleep(SAVE_DELAY).pipe(
      Effect.as(Message.ElapsedSaveItemDelay({ printingId, revision })),
    ),
})

export const SaveItem = Command.define('SaveItem', {
  args: {
    printingId: Printing.PrintingId,
    quantity: Collection.Quantity,
    revision: Schema.Int,
  },
  messages: [Message.SucceededSaveItem, Message.FailedSaveItem],
  execute: ({ printingId, quantity, revision }) =>
    Effect.gen(function* () {
      const api = yield* ApiClient
      yield* api.wishlist.setItem({
        params: { printingId },
        payload: { quantity },
      })
      return Message.SucceededSaveItem({ printingId, revision })
    }).pipe(
      Effect.catch(() =>
        Effect.succeed(Message.FailedSaveItem({ printingId, revision })),
      ),
    ),
})

const CardTraderLine = Schema.Struct({
  blueprintId: Printing.CardTraderBlueprintId,
  quantity: Schema.Int,
})

const deleteAll = (
  client: CardTraderClient['Service'],
  token: Parameters<CardTraderClient['Service']['deleteWishlist']>[0],
  wishlistIds: ReadonlyArray<Wishlist.CardTraderWishlistId>,
) =>
  Effect.forEach(wishlistIds, wishlistId =>
    client.deleteWishlist(token, wishlistId),
  ).pipe(
    Effect.as(true),
    Effect.catch(() => Effect.succeed(false)),
  )

export const SendWishlist = Command.define('SendWishlist', {
  args: {
    target: SendTarget,
    lines: Schema.NonEmptyArray(CardTraderLine),
  },
  messages: [Message.SucceededSendWishlist, Message.FailedSendWishlist],
  execute: ({ target, lines }) =>
    Effect.gen(function* () {
      const key = targetKey(target)
      const store = yield* TokenStore
      const client = yield* CardTraderClient
      const api = yield* ApiClient
      const maybeStored = yield* store.read

      if (Option.isNone(maybeStored)) {
        return Message.FailedSendWishlist({ key, reason: 'NotConnected' })
      }

      const { token } = maybeStored.value
      const name = wishlistNameOf(target)
      const wishlistId = yield* client.createWishlist(token, { name, lines })
      const previousIds = yield* target._tag === 'Custom'
        ? api.wishlist
            .replaceCardTraderWishlist({ payload: { wishlistId } })
            .pipe(
              Effect.map(({ maybePreviousWishlistId }) =>
                Option.toArray(maybePreviousWishlistId),
              ),
              Effect.mapError((): { reason: SendFailure } => ({
                reason: 'Unavailable',
              })),
            )
        : client
            .listWishlists(token)
            .pipe(
              Effect.map(
                Array.filterMap(listed =>
                  listed.name === name && listed.id !== wishlistId
                    ? Result.succeed(listed.id)
                    : Result.failVoid,
                ),
              ),
            )
      const isPreviousDeleted = yield* deleteAll(client, token, previousIds)

      return Message.SucceededSendWishlist({
        key,
        wishlistId,
        isPreviousDeleted,
      })
    }).pipe(
      Effect.catch(({ reason }) =>
        Effect.succeed(
          Message.FailedSendWishlist({ key: targetKey(target), reason }),
        ),
      ),
    ),
})

// ENTRY

const whenReady = (
  model: Model,
  f: (ready: Ready) => UpdateReturn,
): UpdateReturn => (model._tag === 'Ready' ? f(model) : { model })

const loading = (): UpdateReturn => ({
  model: Model.Loading(),
  commands: [LoadWishlist()],
})

export const ensureLoaded = (model: Model): UpdateReturn =>
  model._tag === 'NotLoaded' ? loading() : { model }

export const retry = (model: Model): UpdateReturn =>
  model._tag === 'Failed' ? loading() : { model }

export type Stepped = Readonly<{
  printingId: Printing.PrintingId
  step: -1 | 1
}>

export type SetAdded = Readonly<{
  printingId: Printing.PrintingId
  quantity: Collection.Quantity
}>

export const setAdded = (model: Model, { printingId, quantity }: SetAdded) =>
  whenReady(model, ready => ({
    model: modifyFields(ready, {
      added: added => Collection.withQuantity(added, printingId, quantity),
      saves: saves =>
        Record.set(
          saves,
          printingId,
          Save.Waiting({ revision: ready.nextRevision }),
        ),
      nextRevision: revision => revision + 1,
    }),
    commands: [WaitToSaveItem({ printingId, revision: ready.nextRevision })],
  }))

export const step = (model: Model, { printingId, step }: Stepped) =>
  whenReady(model, ready => ({
    model: modifyFields(ready, {
      added: added =>
        Collection.withQuantity(
          added,
          printingId,
          Collection.adjust(Collection.quantityOf(added, printingId), step),
        ),
      saves: saves =>
        Record.set(
          saves,
          printingId,
          Save.Waiting({ revision: ready.nextRevision }),
        ),
      nextRevision: revision => revision + 1,
    }),
    commands: [WaitToSaveItem({ printingId, revision: ready.nextRevision })],
  }))

export type Send = Readonly<{
  target: SendTarget
  lines: Array.NonEmptyReadonlyArray<Wishlist.CardTraderLine>
}>

export const sendingOf = (model: Model, key: string): Sending =>
  model._tag === 'Ready'
    ? Option.getOrElse(Record.get(model.sendings, key), () => Sending.Idle())
    : Sending.Idle()

export const send = (model: Model, { target, lines }: Send) =>
  whenReady(model, ready =>
    sendingOf(ready, targetKey(target))._tag === 'Sending'
      ? { model }
      : {
          model: modifyFields(ready, {
            sendings: sendings =>
              Record.set(sendings, targetKey(target), Sending.Sending()),
          }),
          commands: [SendWishlist({ target, lines })],
        },
  )

// UPDATE

const isCurrent = (
  ready: Ready,
  printingId: Printing.PrintingId,
  revision: number,
) =>
  Option.exists(
    Record.get(ready.saves, printingId),
    save => save.revision === revision,
  )

const isWaiting = (
  ready: Ready,
  printingId: Printing.PrintingId,
  revision: number,
) =>
  Option.exists(
    Record.get(ready.saves, printingId),
    save => save._tag === 'Waiting' && save.revision === revision,
  )

export const update = (model: Model, message: Message) =>
  Message.match<UpdateReturn>(message, {
    SucceededLoadWishlist: ({ wishlist }) => ({
      model: Model.Ready({
        added: Collection.fromItems(wishlist.items),
        maybeSentWishlistId: wishlist.maybeCardTraderWishlistId,
        saves: {},
        nextRevision: 0,
        sendings: {},
      }),
    }),

    FailedLoadWishlist: () => ({ model: Model.Failed() }),

    ElapsedSaveItemDelay: ({ printingId, revision }) =>
      whenReady(model, ready =>
        isWaiting(ready, printingId, revision)
          ? {
              model: modifyFields(ready, {
                saves: saves =>
                  Record.set(saves, printingId, Save.Saving({ revision })),
              }),
              commands: [
                SaveItem({
                  printingId,
                  quantity: Collection.quantityOf(ready.added, printingId),
                  revision,
                }),
              ],
            }
          : { model },
      ),

    SucceededSaveItem: ({ printingId, revision }) =>
      whenReady(model, ready =>
        isCurrent(ready, printingId, revision)
          ? {
              model: modifyFields(ready, {
                saves: saves => Record.remove(saves, printingId),
              }),
            }
          : { model },
      ),

    FailedSaveItem: ({ printingId, revision }) =>
      whenReady(model, ready =>
        isCurrent(ready, printingId, revision)
          ? {
              model: modifyFields(ready, {
                saves: saves =>
                  Record.set(saves, printingId, Save.Failed({ revision })),
              }),
            }
          : { model },
      ),

    ClickedRetryItemSaves: () =>
      whenReady(model, ready => {
        const retries = Array.map(
          Record.keys(
            Record.filter(ready.saves, save => save._tag === 'Failed'),
          ),
          (printingId, index) => ({
            printingId,
            revision: ready.nextRevision + index,
          }),
        )

        return {
          model: modifyFields(ready, {
            saves: saves =>
              Array.reduce(retries, saves, (next, { printingId, revision }) =>
                Record.set(next, printingId, Save.Saving({ revision })),
              ),
            nextRevision: revision => revision + Array.length(retries),
          }),
          commands: Array.map(retries, ({ printingId, revision }) =>
            SaveItem({
              printingId,
              quantity: Collection.quantityOf(ready.added, printingId),
              revision,
            }),
          ),
        }
      }),

    SucceededSendWishlist: ({ key, wishlistId, isPreviousDeleted }) =>
      whenReady(model, ready => ({
        model: modifyFields(ready, {
          sendings: sendings =>
            Record.set(
              sendings,
              key,
              Sending.Sent({ wishlistId, isPreviousDeleted }),
            ),
        }),
      })),

    FailedSendWishlist: ({ key, reason }) =>
      whenReady(model, ready => ({
        model: modifyFields(ready, {
          sendings: sendings =>
            Record.set(sendings, key, Sending.Failed({ reason })),
        }),
      })),
  })

// QUERY

export const failedSaveCount = (model: Model): number =>
  model._tag === 'Ready'
    ? Record.size(Record.filter(model.saves, save => save._tag === 'Failed'))
    : 0

export const maybeAdded = (model: Model): Option.Option<Collection.Owned> =>
  model._tag === 'Ready' ? Option.some(model.added) : Option.none()
