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
import { printing, testCard } from '../../../../testing'
import { Message, OutMessage } from './message'
import { type AddTab, init } from './model'
import {
  FindRunes,
  SearchCardsToAdd,
  WaitBeforeClearingUndo,
  update,
} from './update'

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
      Message.SucceededLoadCardToAdd({
        card: testCard,
        tab: 'Legend',
        target: 'Deck',
      }),
    ).model
    const entryId = Option.getOrThrow(
      Option.map(Array.head(chosen.toast.entries), ({ id }) => id),
    )

    story(
      update(Option.some(deck)),
      given(onLegends),
      message(
        Message.SucceededLoadCardToAdd({
          card: testCard,
          tab: 'Legend',
          target: 'Deck',
        }),
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
      Message.SucceededLoadCardToAdd({
        card: testCard,
        tab: 'Unit',
        target: 'Deck',
      }),
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

describe('runes', () => {
  const legend = printing({
    id: Printing.PrintingId.make('tst-050-010'),
    cardId: Printing.CardId.make('test-legend'),
    maybeType: Option.some('Legend'),
    domains: ['Fury', 'Calm'],
  })
  const runeCard = (id: string, domain: Printing.Domain): Printing.Card => ({
    id: Printing.CardId.make(`${id}-rune`),
    printings: [
      printing({
        id: Printing.PrintingId.make(
          `tst-${id === 'fury' ? '060' : '061'}-010`,
        ),
        cardId: Printing.CardId.make(`${id}-rune`),
        maybeType: Option.some('Rune'),
        domains: [domain],
      }),
    ],
  })
  const fury = runeCard('fury', 'Fury')
  const calm = runeCard('calm', 'Calm')
  const withLegend: Deck.Deck = {
    ...deck,
    contents: { ...deck.contents, maybeLegend: Option.some(legend.id) },
  }
  const loadedLegend = modifyFields(init(), {
    maybeDeckId: () => Option.some(deck.id),
    cards: () => ({
      [legend.cardId]: { id: legend.cardId, printings: [legend] },
    }),
  })

  test('splitting finds a rune per legend domain and adds six of each', () => {
    const asked = update(Option.some(withLegend))(
      loadedLegend,
      Message.ClickedSplitRunes(),
    )

    expect(
      asked.commands?.map(({ name, args }) => ({ name, args })),
    ).toStrictEqual([
      { name: FindRunes.name, args: { domains: ['Fury', 'Calm'] } },
    ])

    const split = update(Option.some(withLegend))(
      loadedLegend,
      Message.SucceededFindRunes({ cards: [fury, calm] }),
    )
    const edits =
      split.outMessage?._tag === 'EditedDeck' ? split.outMessage.edits : []

    expect(Array.length(edits)).toBe(12)
    expect(
      Array.length(
        Array.filter(
          edits,
          edit =>
            edit._tag === 'StepCopies' &&
            edit.zone === 'Runes' &&
            edit.printingId === Printing.PrintingId.make('tst-060-010'),
        ),
      ),
    ).toBe(6)
  })
})

describe('undo and the sheet', () => {
  const base = Printing.PrintingId.make('tst-001-010')
  const oneCopy: Deck.Deck = {
    ...deck,
    contents: {
      ...deck.contents,
      main: [{ printingId: base, copies: Deck.Copies.make(1) }],
    },
  }
  const withCard = modifyFields(init(), {
    maybeDeckId: () => Option.some(deck.id),
    cards: () => ({ [testCard.id]: testCard }),
  })

  test('removing the last copy can be undone for a while', () => {
    const removed = update(Option.some(oneCopy))(
      withCard,
      Message.ClickedStepCopies({
        cardId: testCard.id,
        maybeVersion: Option.some(base),
        zone: 'Main',
        step: -1,
      }),
    )

    expect(
      Option.map(removed.model.maybeUndo, ({ text }) => text),
    ).toStrictEqual(
      Option.some('Removed Test Unit, Tester from the main deck.'),
    )
    expect(removed.commands?.map(({ name }) => name)).toStrictEqual([
      WaitBeforeClearingUndo.name,
    ])

    const undone = update(Option.some({ ...oneCopy, contents: deck.contents }))(
      removed.model,
      Message.ClickedUndo(),
    )

    expect(undone.outMessage).toStrictEqual(
      OutMessage.EditedDeck({
        deckId: deck.id,
        edits: [
          { _tag: 'StepCopies', zone: 'Main', printingId: base, step: 1 },
        ],
      }),
    )
    expect(undone.model.maybeUndo).toStrictEqual(Option.none())

    const expired = update(Option.some(oneCopy))(
      removed.model,
      Message.CompletedWaitBeforeClearingUndo({ id: 0 }),
    )

    expect(expired.model.maybeUndo).toStrictEqual(Option.none())
  })

  test('removing one of several copies offers no undo', () => {
    const removed = update(Option.some(oneCopy))(
      modifyFields(withCard, {}),
      Message.ClickedStepCopies({
        cardId: testCard.id,
        maybeVersion: Option.some(base),
        zone: 'Sideboard',
        step: -1,
      }),
    )

    expect(removed.model.maybeUndo).toStrictEqual(Option.none())
  })

  test('asking to add cards opens the sheet, and it can be closed', () => {
    const opened = update(Option.some(oneCopy))(
      withCard,
      Message.SelectedAddTab({ tab: 'Spell' }),
    )

    expect(opened.model.isSheetOpen).toBe(true)
    expect(
      update(Option.some(oneCopy))(opened.model, Message.ClickedToggleSheet())
        .model.isSheetOpen,
    ).toBe(false)
  })

  test('duplicating asks for a copy with the same cards', () => {
    expect(
      update(Option.some(oneCopy))(withCard, Message.ClickedDuplicate())
        .outMessage,
    ).toStrictEqual(
      OutMessage.RequestedDuplicateDeck({
        name: Deck.DeckName.make('Test deck (copy)'),
        contents: oneCopy.contents,
      }),
    )
  })
})
