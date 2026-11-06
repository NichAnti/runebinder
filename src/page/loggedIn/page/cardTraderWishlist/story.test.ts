import { Array, Option } from 'effect'
import { expectOutMessage, given, message, model, story } from 'foldkit/story'
import { modifyFields } from 'foldkit/struct'
import { describe, expect, test } from 'vitest'

import { Toast as HeadlessToast } from '@foldkit/ui'

import { type CardTraderImport, Printing, Wishlist } from '../../../../domain'
import { testCard } from '../../../../testing'
import { Message, OutMessage } from './message'
import { init } from './model'
import { MatchLines, enter, update } from './update'

const wishlistId = Wishlist.CardTraderWishlistId.make(3572164)
const base = Printing.PrintingId.make('tst-001-010')

const lines: ReadonlyArray<CardTraderImport.ImportLine> = [
  {
    key: 'missing|tst',
    metaName: 'missing',
    expansionCode: 'tst',
    quantity: 1,
    match: { _tag: 'NotInCatalogue' },
  },
  {
    key: 'test-unit|tst',
    metaName: 'test-unit',
    expansionCode: 'tst',
    quantity: 2,
    match: { _tag: 'Matched', cardId: testCard.id, printingId: base },
  },
]

const matched = modifyFields(init(), {
  maybeMatched: () =>
    Option.some({ wishlistId, lines, cards: { [testCard.id]: testCard } }),
})

const importAll = Message.ClickedImport({
  keys: ['missing|tst', 'test-unit|tst'],
})

describe('importing a CardTrader wishlist', () => {
  test('its lines are matched once the catalogue is ready', () => {
    const remote = { id: wishlistId, name: 'Fair', items: [] }

    expect(enter(init(), Option.some(remote), false).commands).toBeUndefined()
    expect(
      enter(init(), Option.some(remote), true).commands?.map(
        ({ name }) => name,
      ),
    ).toStrictEqual([MatchLines.name])
    expect(enter(matched, Option.some(remote), true).commands).toBeUndefined()
  })

  test('only matched lines are imported, and it is confirmed', () => {
    const entryId = Option.getOrThrow(
      Option.map(
        Array.head(update(matched, importAll).model.toast.entries),
        ({ id }) => id,
      ),
    )

    story(
      update,
      given(matched),
      message(importAll),
      model(next => {
        expect(
          Array.map(next.toast.entries, ({ payload }) => payload.text),
        ).toStrictEqual(['Added 2 cards to the custom wishlist.'])
      }),
      expectOutMessage(
        OutMessage.Imported({ items: [{ printingId: base, quantity: 2 }] }),
      ),
      HeadlessToast.test.drainEntry({ entryId }),
    )
  })
})
