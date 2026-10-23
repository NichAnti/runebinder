import {
  Command,
  click,
  expect,
  expectOutMessage,
  given,
  label,
  role,
  scene,
  type,
  withViewInputs,
  within,
} from 'foldkit/scene'
import { describe, test } from 'vitest'

import { Deck } from '../../../../domain'
import * as DecksState from '../../decks'
import { Message, OutMessage } from './message'
import { init } from './model'
import { ReadDeckCode, update } from './update'
import { view } from './view'

const deck: Deck.Deck = {
  id: Deck.DeckId.make('7b0f2a7e-2a9c-4c6e-9d2b-6a6f1c9d2e11'),
  name: Deck.DeckName.make('Vi aggro'),
  contents: Deck.empty,
}

const newForm = role('form', { name: 'New deck' })
const importForm = role('form', { name: 'Import a deck code' })

const sceneView = withViewInputs(view, {
  decks: DecksState.Model.Ready({
    decks: [deck],
    saves: {},
    nextRevision: 0,
    creation: DecksState.Creation.Idle(),
    removals: {},
  }),
})

describe('decks page', () => {
  test('lists decks with a link to each', () => {
    scene(
      { update, view: sceneView() },
      given(init()),
      expect(role('link', { name: 'Vi aggro' })).toHaveAttr(
        'href',
        `/decks/${deck.id}`,
      ),
      expect(role('list', { name: 'Your decks' })).toContainText('0 cards'),
    )
  })

  test('a new deck needs a name', () => {
    scene(
      { update, view: sceneView() },
      given(init()),
      click(role('button', { name: 'Create deck' })),
      expect(role('form', { name: 'New deck' })).toContainText(
        'Give the deck a name',
      ),
      type(within(newForm, label('Name')), 'Jinx burn'),
      click(role('button', { name: 'Create deck' })),
      expectOutMessage(
        OutMessage.RequestedCreateDeck({
          name: Deck.DeckName.make('Jinx burn'),
          contents: Deck.empty,
        }),
      ),
    )
  })

  test('an import that fails says why', () => {
    scene(
      { update, view: sceneView() },
      given(init()),
      type(within(importForm, label('Name')), 'Imported'),
      type(label('Deck code'), 'NOTACODE'),
      click(role('button', { name: 'Import' })),
      Command.resolve(
        ReadDeckCode,
        Message.FailedReadDeckCode({
          problem: { _tag: 'UnknownCard', cardCode: 'OGN-200' },
        }),
      ),
      expect(role('form', { name: 'Import a deck code' })).toContainText(
        'OGN-200 is not in the catalogue.',
      ),
    )
  })
})
