import { Array, Duration, Effect, Option, Record, Schema } from 'effect'
import { Command, type Update } from 'foldkit'
import { modifyFields } from 'foldkit/struct'

import { Collection, Printing } from '../../../domain'
import { ApiClient } from '../../../service'
import { Message } from './message'
import { Model, type Ready, Refresh, Save } from './model'

type UpdateReturn = Update.Return<Model, Message, ApiClient>

const SAVE_DELAY = Duration.millis(600)

// COMMAND

export const LoadCollection = Command.define('LoadCollection', {
  messages: [Message.SucceededLoadCollection, Message.FailedLoadCollection],
  execute: Effect.gen(function* () {
    const api = yield* ApiClient
    const items = yield* api.collection.list()
    return Message.SucceededLoadCollection({ items })
  }).pipe(Effect.catch(() => Effect.succeed(Message.FailedLoadCollection()))),
})

export const WaitToSave = Command.define('WaitToSave', {
  args: { printingId: Printing.PrintingId, revision: Schema.Int },
  messages: [Message.ElapsedSaveDelay],
  execute: ({ printingId, revision }) =>
    Effect.sleep(SAVE_DELAY).pipe(
      Effect.as(Message.ElapsedSaveDelay({ printingId, revision })),
    ),
})

export const SaveQuantity = Command.define('SaveQuantity', {
  args: {
    printingId: Printing.PrintingId,
    quantity: Collection.Quantity,
    revision: Schema.Int,
  },
  messages: [Message.SucceededSaveQuantity, Message.FailedSaveQuantity],
  execute: ({ printingId, quantity, revision }) =>
    Effect.gen(function* () {
      const api = yield* ApiClient
      yield* api.collection.set({
        params: { printingId },
        payload: { quantity },
      })
      return Message.SucceededSaveQuantity({ printingId, revision })
    }).pipe(
      Effect.catch(() =>
        Effect.succeed(Message.FailedSaveQuantity({ printingId, revision })),
      ),
    ),
})

// ENTRY

const loading = (): UpdateReturn => ({
  model: Model.Loading(),
  commands: [LoadCollection()],
})

const whenReady = (
  model: Model,
  f: (ready: Ready) => UpdateReturn,
): UpdateReturn => (model._tag === 'Ready' ? f(model) : { model })

export const ensureLoaded = (model: Model): UpdateReturn =>
  model._tag === 'NotLoaded' ? loading() : { model }

export const refresh = (model: Model): UpdateReturn =>
  Model.match<UpdateReturn>(model, {
    NotLoaded: loading,
    Failed: loading,
    Loading: () => ({ model }),
    Ready: ready =>
      ready.refresh._tag === 'Refreshing'
        ? { model }
        : {
            model: modifyFields(ready, { refresh: () => Refresh.Refreshing() }),
            commands: [LoadCollection()],
          },
  })

export type Change = Readonly<{
  printingId: Printing.PrintingId
  quantity: Collection.Quantity
}>

export const change = (model: Model, { printingId, quantity }: Change) =>
  whenReady(model, ready => ({
    model: modifyFields(ready, {
      owned: owned => Collection.withQuantity(owned, printingId, quantity),
      saves: saves =>
        Record.set(
          saves,
          printingId,
          Save.Waiting({ revision: ready.nextRevision }),
        ),
      nextRevision: revision => revision + 1,
    }),
    commands: [WaitToSave({ printingId, revision: ready.nextRevision })],
  }))

export const Step = Schema.Literals([-1, 1])
export type Step = typeof Step.Type

export type Stepped = Readonly<{
  printingId: Printing.PrintingId
  step: Step
}>

export const step = (model: Model, { printingId, step }: Stepped) =>
  whenReady(model, ready =>
    change(ready, {
      printingId,
      quantity: Collection.adjust(
        Collection.quantityOf(ready.owned, printingId),
        step,
      ),
    }),
  )

// UPDATE

const isCurrent = (
  ready: Ready,
  printingId: Printing.PrintingId,
  revision: number,
): boolean =>
  Option.exists(
    Record.get(ready.saves, printingId),
    save => save.revision === revision,
  )

const isWaiting = (
  ready: Ready,
  printingId: Printing.PrintingId,
  revision: number,
): boolean =>
  Option.exists(
    Record.get(ready.saves, printingId),
    save => save._tag === 'Waiting' && save.revision === revision,
  )

const keepUnsaved = (ready: Ready, fresh: Collection.Owned): Collection.Owned =>
  Record.reduce(ready.saves, fresh, (owned, _save, printingId) =>
    Collection.withQuantity(
      owned,
      printingId,
      Collection.quantityOf(ready.owned, printingId),
    ),
  )

const saveNow = (
  ready: Ready,
  printingId: Printing.PrintingId,
  revision: number,
) =>
  SaveQuantity({
    printingId,
    quantity: Collection.quantityOf(ready.owned, printingId),
    revision,
  })

export const update = (model: Model, message: Message) =>
  Message.match<UpdateReturn>(message, {
    SucceededLoadCollection: ({ items }) => {
      const fresh = Collection.fromItems(items)

      return model._tag === 'Ready'
        ? {
            model: modifyFields(model, {
              owned: () => keepUnsaved(model, fresh),
              refresh: () => Refresh.Idle(),
            }),
          }
        : {
            model: Model.Ready({
              owned: fresh,
              saves: {},
              nextRevision: 0,
              refresh: Refresh.Idle(),
            }),
          }
    },

    FailedLoadCollection: () =>
      model._tag === 'Ready'
        ? { model: modifyFields(model, { refresh: () => Refresh.Failed() }) }
        : { model: Model.Failed() },

    ClickedRetryLoadCollection: () => refresh(model),

    ElapsedSaveDelay: ({ printingId, revision }) =>
      whenReady(model, ready =>
        isWaiting(ready, printingId, revision)
          ? {
              model: modifyFields(ready, {
                saves: saves =>
                  Record.set(saves, printingId, Save.Saving({ revision })),
              }),
              commands: [saveNow(ready, printingId, revision)],
            }
          : { model },
      ),

    SucceededSaveQuantity: ({ printingId, revision }) =>
      whenReady(model, ready =>
        isCurrent(ready, printingId, revision)
          ? {
              model: modifyFields(ready, {
                saves: saves => Record.remove(saves, printingId),
              }),
            }
          : { model },
      ),

    FailedSaveQuantity: ({ printingId, revision }) =>
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

    ClickedRetrySaves: () =>
      whenReady(model, ready => {
        const failed = Record.keys(
          Record.filter(ready.saves, save => save._tag === 'Failed'),
        )
        const retries = Array.map(failed, (printingId, index) => ({
          printingId,
          revision: ready.nextRevision + index,
        }))

        return {
          model: modifyFields(ready, {
            saves: saves =>
              Array.reduce(retries, saves, (next, { printingId, revision }) =>
                Record.set(next, printingId, Save.Saving({ revision })),
              ),
            nextRevision: revision => revision + Array.length(retries),
          }),
          commands: Array.map(retries, ({ printingId, revision }) =>
            saveNow(ready, printingId, revision),
          ),
        }
      }),
  })

// QUERY

export const maybeOwned = (model: Model): Option.Option<Collection.Owned> =>
  model._tag === 'Ready' ? Option.some(model.owned) : Option.none()

export const failedSaveCount = (model: Model): number =>
  model._tag === 'Ready'
    ? Record.size(Record.filter(model.saves, save => save._tag === 'Failed'))
    : 0
