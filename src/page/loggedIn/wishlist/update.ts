import { Array, Duration, Effect, Option, Record, Schema } from 'effect'
import { Command, type Update } from 'foldkit'
import { modifyFields } from 'foldkit/struct'

import {
  type CardTraderImport,
  Collection,
  Printing,
  Wishlist,
} from '../../../domain'
import { ApiClient, CardTraderClient, TokenStore } from '../../../service'
import { Message } from './message'
import {
  type Action,
  type Failure,
  Model,
  Operation,
  type Ready,
  Save,
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

type OperationError = Readonly<{ reason: Failure }>

const notSaved = (): OperationError => ({ reason: 'NotSaved' })

const storedToken = Effect.gen(function* () {
  const store = yield* TokenStore
  return yield* Option.match(yield* store.read, {
    onNone: () => Effect.fail<OperationError>({ reason: 'NotConnected' }),
    onSome: ({ token }) => Effect.succeed(token),
  })
})

const saveLink = (
  wishlist: Wishlist.WishlistRef,
  cardTraderWishlistId: Wishlist.CardTraderWishlistId,
) =>
  Effect.gen(function* () {
    const api = yield* ApiClient
    const payload = { cardTraderWishlistId }

    yield* wishlist._tag === 'Custom'
      ? api.wishlist.linkCustom({ payload })
      : api.wishlist.linkDeck({ params: { deckId: wishlist.deckId }, payload })
  }).pipe(Effect.mapError(notSaved))

const clearLink = (wishlist: Wishlist.WishlistRef) =>
  Effect.gen(function* () {
    const api = yield* ApiClient

    yield* wishlist._tag === 'Custom'
      ? api.wishlist.unlinkCustom()
      : api.wishlist.unlinkDeck({ params: { deckId: wishlist.deckId } })
  }).pipe(Effect.mapError(notSaved))

const failedWith =
  (wishlist: Wishlist.WishlistRef, action: Action) =>
  ({ reason }: OperationError) =>
    Effect.succeed(
      Message.FailedCardTraderOperation({ wishlist, action, reason }),
    )

export const CreateOnCardTrader = Command.define('CreateOnCardTrader', {
  args: {
    wishlist: Wishlist.WishlistRef,
    name: Schema.String,
    lines: Schema.NonEmptyArray(CardTraderLine),
  },
  messages: [
    Message.SucceededCreateOnCardTrader,
    Message.FailedCardTraderOperation,
  ],
  execute: ({ wishlist, name, lines }) =>
    Effect.gen(function* () {
      const client = yield* CardTraderClient
      const token = yield* storedToken
      const cardTraderWishlistId = yield* client.createWishlist(token, {
        name,
        lines,
      })
      yield* saveLink(wishlist, cardTraderWishlistId)

      return Message.SucceededCreateOnCardTrader({
        wishlist,
        cardTraderWishlistId,
        name,
      })
    }).pipe(Effect.catch(failedWith(wishlist, 'Create'))),
})

export const SyncOnCardTrader = Command.define('SyncOnCardTrader', {
  args: {
    wishlist: Wishlist.WishlistRef,
    name: Schema.String,
    lines: Schema.NonEmptyArray(CardTraderLine),
    previousId: Wishlist.CardTraderWishlistId,
  },
  messages: [
    Message.SucceededSyncOnCardTrader,
    Message.FailedCardTraderOperation,
  ],
  execute: ({ wishlist, name, lines, previousId }) =>
    Effect.gen(function* () {
      const client = yield* CardTraderClient
      const token = yield* storedToken
      const cardTraderWishlistId = yield* client.createWishlist(token, {
        name,
        lines,
      })
      yield* saveLink(wishlist, cardTraderWishlistId)
      const isPreviousDeleted = yield* client
        .deleteWishlist(token, previousId)
        .pipe(
          Effect.as(true),
          Effect.catch(() => Effect.succeed(false)),
        )

      return Message.SucceededSyncOnCardTrader({
        wishlist,
        cardTraderWishlistId,
        name,
        previousId,
        isPreviousDeleted,
      })
    }).pipe(Effect.catch(failedWith(wishlist, 'Sync'))),
})

export const DeleteOnCardTrader = Command.define('DeleteOnCardTrader', {
  args: {
    wishlist: Wishlist.WishlistRef,
    cardTraderWishlistId: Wishlist.CardTraderWishlistId,
  },
  messages: [
    Message.SucceededDeleteOnCardTrader,
    Message.FailedCardTraderOperation,
  ],
  execute: ({ wishlist, cardTraderWishlistId }) =>
    Effect.gen(function* () {
      const client = yield* CardTraderClient
      const token = yield* storedToken
      yield* client.deleteWishlist(token, cardTraderWishlistId)
      yield* clearLink(wishlist)

      return Message.SucceededDeleteOnCardTrader({
        wishlist,
        cardTraderWishlistId,
      })
    }).pipe(Effect.catch(failedWith(wishlist, 'Delete'))),
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

export type Outgoing = Readonly<{
  wishlist: Wishlist.WishlistRef
  name: string
  lines: Array.NonEmptyReadonlyArray<Wishlist.CardTraderLine>
}>

export const linkOf = (
  model: Model,
  wishlist: Wishlist.WishlistRef,
): Option.Option<Wishlist.CardTraderWishlistId> =>
  model._tag === 'Ready'
    ? Record.get(model.links, Wishlist.refKey(wishlist))
    : Option.none()

export const operationOf = (
  model: Model,
  wishlist: Wishlist.WishlistRef,
): Option.Option<Operation> =>
  model._tag === 'Ready'
    ? Record.get(model.operations, Wishlist.refKey(wishlist))
    : Option.none()

const isWorking = (ready: Ready, wishlist: Wishlist.WishlistRef) =>
  Option.exists(
    operationOf(ready, wishlist),
    operation => operation._tag === 'Working',
  )

const working = (
  ready: Ready,
  wishlist: Wishlist.WishlistRef,
  action: Action,
): Ready =>
  modifyFields(ready, {
    operations: operations =>
      Record.set(
        operations,
        Wishlist.refKey(wishlist),
        Operation.Working({ action }),
      ),
  })

export const create = (model: Model, { wishlist, name, lines }: Outgoing) =>
  whenReady(model, ready =>
    isWorking(ready, wishlist)
      ? { model }
      : {
          model: working(ready, wishlist, 'Create'),
          commands: [CreateOnCardTrader({ wishlist, name, lines })],
        },
  )

export const sync = (model: Model, { wishlist, name, lines }: Outgoing) =>
  whenReady(model, ready =>
    Option.match(linkOf(ready, wishlist), {
      onNone: () => create(ready, { wishlist, name, lines }),
      onSome: previousId =>
        isWorking(ready, wishlist)
          ? { model }
          : {
              model: working(ready, wishlist, 'Sync'),
              commands: [
                SyncOnCardTrader({ wishlist, name, lines, previousId }),
              ],
            },
    }),
  )

export const remove = (model: Model, wishlist: Wishlist.WishlistRef) =>
  whenReady(model, ready =>
    Option.match(linkOf(ready, wishlist), {
      onNone: () => ({ model }),
      onSome: cardTraderWishlistId =>
        isWorking(ready, wishlist)
          ? { model }
          : {
              model: working(ready, wishlist, 'Delete'),
              commands: [
                DeleteOnCardTrader({ wishlist, cardTraderWishlistId }),
              ],
            },
    }),
  )

export const addAll = (
  model: Model,
  imported: ReadonlyArray<CardTraderImport.Imported>,
) =>
  whenReady(model, ready => {
    const revisioned = Array.map(imported, (item, offset) => ({
      ...item,
      revision: ready.nextRevision + offset,
    }))

    return {
      model: modifyFields(ready, {
        added: added =>
          Array.reduce(revisioned, added, (next, { printingId, quantity }) =>
            Collection.withQuantity(
              next,
              printingId,
              Collection.clampQuantity(
                Collection.quantityOf(next, printingId) + quantity,
              ),
            ),
          ),
        saves: saves =>
          Array.reduce(revisioned, saves, (next, { printingId, revision }) =>
            Record.set(next, printingId, Save.Waiting({ revision })),
          ),
        nextRevision: revision => revision + Array.length(revisioned),
      }),
      commands: Array.map(revisioned, ({ printingId, revision }) =>
        WaitToSaveItem({ printingId, revision }),
      ),
    }
  })

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

const linked = (
  ready: Ready,
  wishlist: Wishlist.WishlistRef,
  maybeId: Option.Option<Wishlist.CardTraderWishlistId>,
): Ready => {
  const key = Wishlist.refKey(wishlist)

  return modifyFields(ready, {
    links: links =>
      Option.match(maybeId, {
        onNone: () => Record.remove(links, key),
        onSome: id => Record.set(links, key, id),
      }),
    operations: operations => Record.remove(operations, key),
  })
}

export const update = (model: Model, message: Message) =>
  Message.match<UpdateReturn>(message, {
    SucceededLoadWishlist: ({ wishlist }) => ({
      model: Model.Ready({
        added: Collection.fromItems(wishlist.items),
        links: Record.fromEntries(
          Array.map(
            wishlist.cardTraderLinks,
            ({
              wishlist,
              cardTraderWishlistId,
            }): readonly [string, Wishlist.CardTraderWishlistId] => [
              Wishlist.refKey(wishlist),
              cardTraderWishlistId,
            ],
          ),
        ),
        saves: {},
        nextRevision: 0,
        operations: {},
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

    SucceededCreateOnCardTrader: ({ wishlist, cardTraderWishlistId }) =>
      whenReady(model, ready => ({
        model: linked(ready, wishlist, Option.some(cardTraderWishlistId)),
      })),

    SucceededSyncOnCardTrader: ({ wishlist, cardTraderWishlistId }) =>
      whenReady(model, ready => ({
        model: linked(ready, wishlist, Option.some(cardTraderWishlistId)),
      })),

    SucceededDeleteOnCardTrader: ({ wishlist }) =>
      whenReady(model, ready => ({
        model: linked(ready, wishlist, Option.none()),
      })),

    FailedCardTraderOperation: ({ wishlist, action, reason }) =>
      whenReady(model, ready => ({
        model: modifyFields(ready, {
          operations: operations =>
            Record.set(
              operations,
              Wishlist.refKey(wishlist),
              Operation.Failed({ action, reason }),
            ),
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
