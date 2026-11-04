import { Array, Option } from 'effect'
import { Command, given, message, model, story } from 'foldkit/story'
import { describe, expect, test } from 'vitest'

import { Toast as HeadlessToast } from '@foldkit/ui'

import { Deck, DeckCode } from '../../../../domain'
import { Message } from './message'
import { init } from './model'
import { CopyDeckCode, update } from './update'

const deck: Deck.Deck = {
  id: Deck.DeckId.make('7b0f2a7e-2a9c-4c6e-9d2b-6a6f1c9d2e11'),
  name: Deck.DeckName.make('Vi aggro'),
  contents: Deck.empty,
}

describe('copying a deck code from the decks page', () => {
  test('copying writes the deck code to the clipboard', () => {
    const copied = update([deck])(
      init(),
      Message.ClickedCopyCode({ deckId: deck.id }),
    )

    expect(copied.commands?.map(({ name }) => name)).toStrictEqual([
      CopyDeckCode.name,
    ])
  })

  test('a copied code is confirmed', () => {
    const code = DeckCode.DeckCode.make('CODE')
    const confirmed = update([deck])(
      init(),
      Message.CompletedCopyDeckCode({ code }),
    )
    const entryId = Option.getOrThrow(
      Option.map(Array.head(confirmed.model.toast.entries), ({ id }) => id),
    )

    story(
      update([deck]),
      given(init()),
      message(Message.CompletedCopyDeckCode({ code })),
      model(next => {
        expect(
          Array.map(next.toast.entries, ({ payload }) => payload.text),
        ).toStrictEqual(['Copied the deck code.'])
      }),
      HeadlessToast.test.drainEntry({ entryId }),
      Command.expectNone(),
    )
  })
})
