import { Array, Option } from 'effect'
import { expectOutMessage, given, message, model, story } from 'foldkit/story'
import { describe, expect, test } from 'vitest'

import { Toast as HeadlessToast } from '@foldkit/ui'

import { Printing } from '../../../../domain'
import { Message, OutMessage } from './message'
import { init } from './model'
import type { Context } from './sections'
import { update } from './update'

const wanted = Printing.PrintingId.make('tst-001a-010')
const arrived = Printing.PrintingId.make('tst-001-010')
const context: Context = { decks: [], owned: {}, added: {} }

describe('marking as bought', () => {
  test('records the version that arrived and confirms it', () => {
    const marked = update(context)(
      init(),
      Message.ClickedBought({
        purchases: [{ wanted, bought: arrived, copies: 2, isCustom: true }],
      }),
    ).model
    const entryId = Option.getOrThrow(
      Option.map(Array.head(marked.toast.entries), ({ id }) => id),
    )

    story(
      update(context),
      given(init()),
      message(
        Message.ClickedBought({
          purchases: [{ wanted, bought: arrived, copies: 2, isCustom: true }],
        }),
      ),
      model(next => {
        expect(
          Array.map(next.toast.entries, ({ payload }) => payload.text),
        ).toStrictEqual(['Added 2 cards to your collection.'])
      }),
      expectOutMessage(
        OutMessage.MarkedBought({
          purchases: [{ wanted, bought: arrived, copies: 2, isCustom: true }],
        }),
      ),
      HeadlessToast.test.drainEntry({ entryId }),
    )
  })
})
