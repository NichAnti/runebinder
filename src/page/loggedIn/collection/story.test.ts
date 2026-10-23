import { Command, given, message, model, story } from 'foldkit/story'
import { describe, expect, test } from 'vitest'

import { Collection, Printing } from '../../../domain'
import { Message } from './message'
import { Model, Save, init } from './model'
import {
  LoadCollection,
  SaveQuantity,
  WaitToSave,
  change,
  ensureLoaded,
  failedSaveCount,
  retry,
  update,
} from './update'

const vi = Printing.PrintingId.make('ogn-066-298')
const jinx = Printing.PrintingId.make('ogn-001-298')
const owned = (value: number) => Collection.OwnedQuantity.make(value)
const quantity = (value: number) => Collection.Quantity.make(value)

const ready = Model.Ready({
  owned: { [vi]: owned(1) },
  saves: {},
  nextRevision: 0,
})

describe('loading the collection', () => {
  test('it loads once, the first time a screen needs it', () => {
    const first = ensureLoaded(init())

    expect(first.model).toStrictEqual(Model.Loading())
    expect(first.commands?.map(({ name }) => name)).toStrictEqual([
      LoadCollection.name,
    ])
    expect(ensureLoaded(first.model).commands).toBeUndefined()
    expect(ensureLoaded(ready).commands).toBeUndefined()
  })

  test('a loaded collection becomes ready', () => {
    story(
      update,
      given(Model.Loading()),
      message(
        Message.SucceededLoadCollection({
          items: [{ printingId: vi, quantity: owned(2) }],
        }),
      ),
      model(next => {
        expect(next).toStrictEqual(
          Model.Ready({
            owned: { [vi]: owned(2) },
            saves: {},
            nextRevision: 0,
          }),
        )
      }),
    )
  })

  test('a failed load can be retried', () => {
    story(
      update,
      given(Model.Loading()),
      message(Message.FailedLoadCollection()),
      model(next => {
        expect(next).toStrictEqual(Model.Failed())
      }),
      message(Message.ClickedRetryLoadCollection()),
      Command.expectExact(LoadCollection),
      Command.resolve(
        LoadCollection,
        Message.SucceededLoadCollection({ items: [] }),
      ),
    )
  })
})

describe('saving changes', () => {
  test('only the last change in a burst is saved', () => {
    const first = change(ready, { printingId: vi, quantity: quantity(2) })
    const second = change(first.model, {
      printingId: vi,
      quantity: quantity(3),
    })

    story(
      update,
      given(second.model),
      message(Message.ElapsedSaveDelay({ printingId: vi, revision: 0 })),
      Command.expectNone(),
      message(Message.ElapsedSaveDelay({ printingId: vi, revision: 1 })),
      Command.expectExact(SaveQuantity),
      model(next => {
        expect(next._tag === 'Ready' && next.owned[vi]).toBe(3)
      }),
      Command.resolve(
        SaveQuantity,
        Message.SucceededSaveQuantity({ printingId: vi, revision: 1 }),
      ),
      model(next => {
        expect(next._tag === 'Ready' && next.saves).toStrictEqual({})
      }),
    )
    expect(second.commands?.map(({ name }) => name)).toStrictEqual([
      WaitToSave.name,
    ])
  })

  test('a change made while saving is saved after it', () => {
    const first = change(ready, { printingId: vi, quantity: quantity(2) })
    const saving = update(
      first.model,
      Message.ElapsedSaveDelay({ printingId: vi, revision: 0 }),
    ).model
    const changedAgain = change(saving, {
      printingId: vi,
      quantity: quantity(4),
    })
    const settled = update(
      changedAgain.model,
      Message.SucceededSaveQuantity({ printingId: vi, revision: 0 }),
    ).model

    expect(settled._tag === 'Ready' && settled.saves[vi]).toStrictEqual(
      Save.Waiting({ revision: 1 }),
    )
  })

  test('removing the last copy removes the printing', () => {
    const removed = change(ready, { printingId: vi, quantity: Collection.NONE })

    expect(removed.model._tag === 'Ready' && removed.model.owned).toStrictEqual(
      {},
    )
  })

  test('failed saves are kept and can be retried', () => {
    const changed = change(ready, { printingId: jinx, quantity: quantity(1) })

    story(
      update,
      given(changed.model),
      message(Message.ElapsedSaveDelay({ printingId: jinx, revision: 0 })),
      Command.resolve(
        SaveQuantity,
        Message.FailedSaveQuantity({ printingId: jinx, revision: 0 }),
      ),
      model(next => {
        expect(failedSaveCount(next)).toBe(1)
        expect(next._tag === 'Ready' && next.owned[jinx]).toBe(1)
      }),
      message(Message.ClickedRetrySaves()),
      Command.expectExact(SaveQuantity),
      Command.resolve(
        SaveQuantity,
        Message.SucceededSaveQuantity({ printingId: jinx, revision: 1 }),
      ),
      model(next => {
        expect(failedSaveCount(next)).toBe(0)
      }),
    )
  })
})

describe('retrying', () => {
  test('only a failed load is retried', () => {
    expect(retry(ready).commands).toBeUndefined()
    expect(retry(Model.Loading()).commands).toBeUndefined()
    expect(
      retry(Model.Failed()).commands?.map(({ name }) => name),
    ).toStrictEqual([LoadCollection.name])
  })
})
