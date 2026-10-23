import { Array, Duration, Effect, Option, Record, Schema } from 'effect'
import { Command, type Update } from 'foldkit'
import { modifyFields } from 'foldkit/struct'

import { Collection, Printing, Wishlist } from '../../../domain'
import { ApiClient, CardTraderClient, TokenStore } from '../../../service'
import { Message } from './message'
import { Model, type Ready, Save, type SendFailure, Sending } from './model'

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

export const SendWishlist = Command.define('SendWishlist', {
  args: {
    name: Schema.String,
    lines: Schema.NonEmptyArray(CardTraderLine),
  },
  messages: [Message.SucceededSendWishlist, Message.FailedSendWishlist],
  execute: ({ name, lines }) =>
    Effect.gen(function* () {
      const store = yield* TokenStore
      const client = yield* CardTraderClient
      const api = yield* ApiClient
      const maybeStored = yield* store.read

      if (Option.isNone(maybeStored)) {
        return Message.FailedSendWishlist({ reason: 'NotConnected' })
      }

      const { token } = maybeStored.value
      const wishlistId = yield* client.createWishlist(token, { name, lines })
      const replaced = yield* api.wishlist
        .replaceCardTraderWishlist({ payload: { wishlistId } })
        .pipe(
          Effect.mapError((): { reason: SendFailure } => ({
            reason: 'Unavailable',
          })),
        )
      const isPreviousDeleted = yield* Option.match(
        replaced.maybePreviousWishlistId,
        {
          onNone: () => Effect.succeed(true),
          onSome: previous =>
            client.deleteWishlist(token, previous).pipe(
              Effect.as(true),
              Effect.catch(() => Effect.succeed(false)),
            ),
        },
      )

      return Message.SucceededSendWishlist({ wishlistId, isPreviousDeleted })
    }).pipe(
      Effect.catch(({ reason }) =>
        Effect.succeed(Message.FailedSendWishlist({ reason })),
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
  name: string
  lines: Array.NonEmptyReadonlyArray<Wishlist.CardTraderLine>
}>

export const send = (model: Model, { name, lines }: Send) =>
  whenReady(model, ready =>
    ready.sending._tag === 'Sending'
      ? { model }
      : {
          model: modifyFields(ready, { sending: () => Sending.Sending() }),
          commands: [SendWishlist({ name, lines })],
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
        sending: Sending.Idle(),
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

    SucceededSendWishlist: ({ wishlistId, isPreviousDeleted }) =>
      whenReady(model, ready => ({
        model: modifyFields(ready, {
          maybeSentWishlistId: () => Option.some(wishlistId),
          sending: () => Sending.Sent({ wishlistId, isPreviousDeleted }),
        }),
      })),

    FailedSendWishlist: ({ reason }) =>
      whenReady(model, ready => ({
        model: modifyFields(ready, {
          sending: () => Sending.Failed({ reason }),
        }),
      })),
  })

// QUERY

export const maybeAdded = (model: Model): Option.Option<Collection.Owned> =>
  model._tag === 'Ready' ? Option.some(model.added) : Option.none()
