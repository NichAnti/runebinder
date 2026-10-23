import { Array, Option } from 'effect'
import {
  Command,
  expectOutMessage,
  given,
  message,
  model,
  story,
} from 'foldkit/story'
import { modifyFields } from 'foldkit/struct'
import { describe, expect, test } from 'vitest'

import { Toast as HeadlessToast } from '@foldkit/ui'

import { Deck, Printing } from '../../../../domain'
import { testCard } from '../../../../testing'
import { Message, OutMessage } from './message'
import { type AddTab, init } from './model'
import { SearchCardsToAdd, update } from './update'

const base = Printing.PrintingId.make('tst-001-010')
const deck: Deck.Deck = {
  id: Deck.DeckId.make('7b0f2a7e-2a9c-4c6e-9d2b-6a6f1c9d2e11'),
  name: Deck.DeckName.make('Test deck'),
  contents: Deck.empty,
}

describe('adding cards', () => {
  test('choosing a legend confirms it and moves on to champions', () => {
    const onLegends = modifyFields(init(), {
      maybeDeckId: () => Option.some(deck.id),
      addTab: (): AddTab => 'Legend',
    })
    const chosen = update(Option.some(deck))(
      onLegends,
      Message.SucceededLoadCardToAdd({ card: testCard, tab: 'Legend' }),
    ).model
    const entryId = Option.getOrThrow(
      Option.map(Array.head(chosen.toast.entries), ({ id }) => id),
    )

    story(
      update(Option.some(deck)),
      given(onLegends),
      message(
        Message.SucceededLoadCardToAdd({ card: testCard, tab: 'Legend' }),
      ),
      model(next => {
        expect(next.addTab).toBe('Champion')
        expect(
          Array.map(next.toast.entries, ({ payload }) => payload.text),
        ).toStrictEqual(['Test Unit, Tester is the legend.'])
      }),
      expectOutMessage(
        OutMessage.EditedDeck({
          deckId: deck.id,
          edits: [
            {
              _tag: 'AddCard',
              printingId: base,
              maybeType: Option.some('Legend'),
            },
          ],
        }),
      ),
      Command.resolve(
        SearchCardsToAdd,
        Message.SucceededSearchCardsToAdd({
          term: '',
          tab: 'Champion',
          cards: [],
        }),
      ),
      HeadlessToast.test.drainEntry({ entryId }),
    )
  })

  test('adding a unit adds a copy without a toast', () => {
    const onUnits = modifyFields(init(), {
      maybeDeckId: () => Option.some(deck.id),
      addTab: (): AddTab => 'Unit',
    })
    const added = update(Option.some(deck))(
      onUnits,
      Message.SucceededLoadCardToAdd({ card: testCard, tab: 'Unit' }),
    )

    expect(added.model.toast.entries).toStrictEqual([])
    expect(added.outMessage).toStrictEqual(
      OutMessage.EditedDeck({
        deckId: deck.id,
        edits: [
          {
            _tag: 'AddCard',
            printingId: Printing.PrintingId.make('tst-001-010'),
            maybeType: Option.some('Unit'),
          },
        ],
      }),
    )
    expect(added.model.addTab).toBe('Unit')
  })
})
