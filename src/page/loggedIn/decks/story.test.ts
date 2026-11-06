import { Option } from 'effect'
import {
  Command,
  expectOutMessage,
  given,
  message,
  model,
  story,
} from 'foldkit/story'
import { describe, expect, test } from 'vitest'

import { Deck, Printing } from '../../../domain'
import { Message, OutMessage } from './message'
import { Creation, Model } from './model'
import {
  CreateDeck,
  RemoveDeck,
  SaveDeck,
  create,
  edit,
  ensureLoaded,
  failedSaveCount,
  maybeDeck,
  remove,
  update,
} from './update'

const deckId = Deck.DeckId.make('7b0f2a7e-2a9c-4c6e-9d2b-6a6f1c9d2e11')
const vi = Printing.PrintingId.make('ogn-103-298')
const name = Deck.DeckName.make('Vi aggro')
const deck: Deck.Deck = { id: deckId, name, contents: Deck.empty }

const ready = Model.Ready({
  decks: [deck],
  saves: {},
  nextRevision: 0,
  creation: Creation.Idle(),
  removals: {},
})

const addVi = (model: Model) =>
  edit(model, {
    deckId,
    edits: [
      {
        _tag: 'AddCard',
        printingId: vi,
        maybeType: Option.some('Unit'),
      },
    ],
  })

describe('decks', () => {
  test('they load once, the first time a deck screen needs them', () => {
    const first = ensureLoaded(Model.NotLoaded())

    expect(first.model).toStrictEqual(Model.Loading())
    expect(ensureLoaded(first.model).commands).toBeUndefined()
  })

  test('a created deck is added and opened', () => {
    story(
      update,
      given(create(ready, { name, contents: Deck.empty }).model),
      message(Message.SucceededCreateDeck({ deck })),
      expectOutMessage(OutMessage.CreatedDeck({ deckId })),
    )
    expect(
      create(ready, { name, contents: Deck.empty }).commands?.map(
        ({ name }) => name,
      ),
    ).toStrictEqual([CreateDeck.name])
  })

  test('only the last edit in a burst is saved', () => {
    const edited = addVi(addVi(ready).model)

    story(
      update,
      given(edited.model),
      message(Message.ElapsedSaveDeckDelay({ deckId, revision: 0 })),
      Command.expectNone(),
      message(Message.ElapsedSaveDeckDelay({ deckId, revision: 1 })),
      Command.expectExact(SaveDeck),
      Command.resolve(
        SaveDeck,
        Message.SucceededSaveDeck({ deckId, revision: 1 }),
      ),
      model(next => {
        expect(
          Option.map(maybeDeck(next, deckId), ({ contents }) => contents.main),
        ).toStrictEqual(
          Option.some([{ printingId: vi, copies: Deck.Copies.make(2) }]),
        )
      }),
    )
  })

  test('a failed save is kept and can be retried', () => {
    story(
      update,
      given(addVi(ready).model),
      message(Message.ElapsedSaveDeckDelay({ deckId, revision: 0 })),
      Command.resolve(
        SaveDeck,
        Message.FailedSaveDeck({ deckId, revision: 0 }),
      ),
      model(next => {
        expect(failedSaveCount(next)).toBe(1)
      }),
      message(Message.ClickedRetryDeckSaves()),
      Command.resolve(
        SaveDeck,
        Message.SucceededSaveDeck({ deckId, revision: 1 }),
      ),
      model(next => {
        expect(failedSaveCount(next)).toBe(0)
      }),
    )
  })

  test('a removed deck leaves the list', () => {
    story(
      update,
      given(remove(ready, deckId).model),
      message(Message.SucceededRemoveDeck({ deckId })),
      model(next => {
        expect(maybeDeck(next, deckId)).toStrictEqual(Option.none())
      }),
      expectOutMessage(OutMessage.RemovedDeck({ deckId })),
    )
    expect(
      remove(ready, deckId).commands?.map(({ name }) => name),
    ).toStrictEqual([RemoveDeck.name])
  })
})
