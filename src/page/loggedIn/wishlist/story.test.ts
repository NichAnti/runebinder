import { Option } from 'effect'
import { Command, given, message, model, story } from 'foldkit/story'
import { describe, expect, test } from 'vitest'

import { Collection, Printing, Wishlist } from '../../../domain'
import { Message } from './message'
import { CUSTOM_KEY, Model, Sending } from './model'
import {
  SaveItem,
  SendWishlist,
  failedSaveCount,
  send,
  sendingOf,
  step,
  update,
} from './update'

const vi = Printing.PrintingId.make('ogn-066-298')
const ready = Model.Ready({
  added: {},
  maybeSentWishlistId: Option.none(),
  saves: {},
  nextRevision: 0,
  sendings: {},
})
const wishlistId = Wishlist.CardTraderWishlistId.make(3572164)

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

  test('sending shows the new CardTrader wishlist', () => {
    const sending = send(ready, {
      target: { _tag: 'Custom' },
      lines: [
        {
          blueprintId: Printing.CardTraderBlueprintId.make(345245),
          quantity: 2,
        },
      ],
    })

    expect(sending.commands?.map(({ name }) => name)).toStrictEqual([
      SendWishlist.name,
    ])
    story(
      update,
      given(sending.model),
      message(
        Message.SucceededSendWishlist({
          key: CUSTOM_KEY,
          wishlistId,
          isPreviousDeleted: true,
        }),
      ),
      model(next => {
        expect(sendingOf(next, CUSTOM_KEY)).toStrictEqual(
          Sending.Sent({ wishlistId, isPreviousDeleted: true }),
        )
      }),
    )
  })

  test('sending without a connected token says so', () => {
    story(
      update,
      given(ready),
      message(
        Message.FailedSendWishlist({ key: CUSTOM_KEY, reason: 'NotConnected' }),
      ),
      model(next => {
        expect(sendingOf(next, CUSTOM_KEY)).toStrictEqual(
          Sending.Failed({ reason: 'NotConnected' }),
        )
      }),
    )
  })
})
