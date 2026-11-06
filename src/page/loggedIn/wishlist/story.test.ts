import { type Array, Option } from 'effect'
import { Command, given, message, model, story } from 'foldkit/story'
import { describe, expect, test } from 'vitest'

import { Collection, Printing, Wishlist } from '../../../domain'
import { Message } from './message'
import { Model, Operation } from './model'
import {
  CreateOnCardTrader,
  DeleteOnCardTrader,
  SaveItem,
  SyncOnCardTrader,
  WaitToSaveItem,
  addAll,
  create,
  failedSaveCount,
  linkOf,
  operationOf,
  remove,
  step,
  sync,
  update,
} from './update'

const vi = Printing.PrintingId.make('ogn-066-298')
const ready = Model.Ready({
  added: {},
  links: {},
  saves: {},
  nextRevision: 0,
  operations: {},
})
const wishlistId = Wishlist.CardTraderWishlistId.make(3572164)
const newWishlistId = Wishlist.CardTraderWishlistId.make(3572165)
const lines: Array.NonEmptyReadonlyArray<Wishlist.CardTraderLine> = [
  { blueprintId: Printing.CardTraderBlueprintId.make(345245), quantity: 2 },
]
const outgoing = {
  wishlist: Wishlist.CUSTOM,
  name: 'Custom wishlist (Runebinder)',
  lines,
}
const linked = Model.Ready({
  added: {},
  links: { custom: wishlistId },
  saves: {},
  nextRevision: 0,
  operations: {},
})

describe('wishlist', () => {
  test('a card added by hand is saved after a pause', () => {
    const stepped = step(step(ready, { printingId: vi, step: 1 }).model, {
      printingId: vi,
      step: 1,
    })

    story(
      update,
      given(stepped.model),
      message(Message.ElapsedSaveItemDelay({ printingId: vi, revision: 0 })),
      Command.expectNone(),
      message(Message.ElapsedSaveItemDelay({ printingId: vi, revision: 1 })),
      Command.expectExact(SaveItem),
      Command.resolve(
        SaveItem,
        Message.SucceededSaveItem({ printingId: vi, revision: 1 }),
      ),
      model(next => {
        expect(next._tag === 'Ready' && next.added).toStrictEqual({
          [vi]: Collection.OwnedQuantity.make(2),
        })
      }),
    )
  })

  test('a failed save is kept and can be retried', () => {
    const stepped = step(ready, { printingId: vi, step: 1 })

    story(
      update,
      given(stepped.model),
      message(Message.ElapsedSaveItemDelay({ printingId: vi, revision: 0 })),
      Command.resolve(
        SaveItem,
        Message.FailedSaveItem({ printingId: vi, revision: 0 }),
      ),
      model(next => {
        expect(failedSaveCount(next)).toBe(1)
      }),
      message(Message.ClickedRetryItemSaves()),
      Command.resolve(
        SaveItem,
        Message.SucceededSaveItem({ printingId: vi, revision: 1 }),
      ),
      model(next => {
        expect(failedSaveCount(next)).toBe(0)
      }),
    )
  })

  test('creating on CardTrader links the new wishlist', () => {
    const creating = create(ready, outgoing)

    expect(creating.commands?.map(({ name }) => name)).toStrictEqual([
      CreateOnCardTrader.name,
    ])
    expect(operationOf(creating.model, Wishlist.CUSTOM)).toStrictEqual(
      Option.some(Operation.Working({ action: 'Create' })),
    )
    story(
      update,
      given(creating.model),
      message(
        Message.SucceededCreateOnCardTrader({
          wishlist: Wishlist.CUSTOM,
          cardTraderWishlistId: wishlistId,
          name: outgoing.name,
        }),
      ),
      model(next => {
        expect(linkOf(next, Wishlist.CUSTOM)).toStrictEqual(
          Option.some(wishlistId),
        )
        expect(operationOf(next, Wishlist.CUSTOM)).toStrictEqual(Option.none())
      }),
    )
  })

  test('syncing replaces the linked wishlist', () => {
    const syncing = sync(linked, outgoing)

    expect(syncing.commands?.map(({ name }) => name)).toStrictEqual([
      SyncOnCardTrader.name,
    ])
    story(
      update,
      given(syncing.model),
      message(
        Message.SucceededSyncOnCardTrader({
          wishlist: Wishlist.CUSTOM,
          cardTraderWishlistId: newWishlistId,
          name: outgoing.name,
          previousId: wishlistId,
          isPreviousDeleted: true,
        }),
      ),
      model(next => {
        expect(linkOf(next, Wishlist.CUSTOM)).toStrictEqual(
          Option.some(newWishlistId),
        )
      }),
    )
  })

  test('deleting on CardTrader clears the link', () => {
    const deleting = remove(linked, Wishlist.CUSTOM)

    expect(deleting.commands?.map(({ name }) => name)).toStrictEqual([
      DeleteOnCardTrader.name,
    ])
    story(
      update,
      given(deleting.model),
      message(
        Message.SucceededDeleteOnCardTrader({
          wishlist: Wishlist.CUSTOM,
          cardTraderWishlistId: wishlistId,
        }),
      ),
      model(next => {
        expect(linkOf(next, Wishlist.CUSTOM)).toStrictEqual(Option.none())
      }),
    )
  })

  test('a second click while working sends nothing', () => {
    const creating = create(ready, outgoing)

    expect(create(creating.model, outgoing).commands).toBeUndefined()
  })

  test('a failure is kept for the wishlist', () => {
    story(
      update,
      given(ready),
      message(
        Message.FailedCardTraderOperation({
          wishlist: Wishlist.CUSTOM,
          action: 'Create',
          reason: 'RateLimited',
        }),
      ),
      model(next => {
        expect(operationOf(next, Wishlist.CUSTOM)).toStrictEqual(
          Option.some(
            Operation.Failed({ action: 'Create', reason: 'RateLimited' }),
          ),
        )
      }),
    )
  })

  test('importing adds to what is already wanted and saves each card', () => {
    const imported = addAll(step(ready, { printingId: vi, step: 1 }).model, [
      { printingId: vi, quantity: 2 },
    ])

    expect(
      imported.model._tag === 'Ready' && imported.model.added,
    ).toStrictEqual({ [vi]: Collection.OwnedQuantity.make(3) })
    expect(imported.commands?.map(({ name }) => name)).toStrictEqual([
      WaitToSaveItem.name,
    ])
  })
})
