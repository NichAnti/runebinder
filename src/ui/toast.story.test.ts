import { Array, Option } from 'effect'
import { given, message, model, story } from 'foldkit/story'
import { describe, expect, test } from 'vitest'

import { Toast as HeadlessToast } from '@foldkit/ui'

import { Message, initialModel, update } from './toast.fixture'

describe('Toast', () => {
  test('a shown message goes away by itself', () => {
    const shown = update(initialModel, Message.ClickedAdd()).model
    const entryId = Option.getOrThrow(
      Option.map(Array.head(shown.toast.entries), ({ id }) => id),
    )

    story(
      update,
      given(initialModel),
      message(Message.ClickedAdd()),
      model(next => {
        expect(
          Array.map(next.toast.entries, ({ payload }) => payload.text),
        ).toStrictEqual(['Added Vi to Main deck'])
      }),
      HeadlessToast.test.drainEntry({ entryId }),
      model(next => {
        expect(next.toast.entries).toStrictEqual([])
      }),
    )
  })
})
