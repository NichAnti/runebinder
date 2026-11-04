import { Option } from 'effect'
import {
  Command,
  Mount,
  click,
  expect,
  expectOutMessage,
  given,
  label,
  role,
  scene,
  text,
  type,
  withViewInputs,
  within,
} from 'foldkit/scene'
import { modifyFields } from 'foldkit/struct'
import { describe, test } from 'vitest'

import { Deck, Printing } from '../../../../domain'
import { printing, testCard } from '../../../../testing'
import { Dialog } from '../../../../ui'
import * as CollectionState from '../../collection'
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
  collection: CollectionState.init(),
  decks: DecksState.Model.Ready({
    decks: [deck],
    saves: {},
    nextRevision: 0,
    creation: DecksState.Creation.Idle(),
    removals: {},
  }),
})

const opened = [
  Command.resolve(Dialog.ShowDialog, Dialog.Message.SucceededShowDialog()),
  Mount.resolve(
    Dialog.AcquireResources,
    Dialog.Message.SucceededAcquireResources(),
  ),
]

describe('decks page', () => {
  test('shows each deck as a card linking to it, with its progress', () => {
    scene(
      { update, view: sceneView() },
      given(init()),
      expect(role('link', { name: 'Vi aggro' })).toHaveAttr(
        'href',
        `/decks/${deck.id}`,
      ),
      expect(role('list', { name: 'Your decks' })).toContainText(
        'Main 0 / 40 · Runes 0 / 12 · Battlefields 0 / 3',
      ),
      expect(role('list', { name: 'Your decks' })).toContainText(
        'No legend yet',
      ),
    )
  })

  test('a deck with a legend shows its art, domains, status and need', () => {
    const legend = printing({
      id: Printing.PrintingId.make('tst-050-010'),
      cardId: Printing.CardId.make('test-legend'),
      maybeType: Option.some('Legend'),
      domains: ['Fury', 'Calm'],
    })
    const withLegend: Deck.Deck = {
      ...deck,
      contents: {
        ...Deck.empty,
        maybeLegend: Option.some(legend.id),
        main: [
          {
            printingId: Printing.PrintingId.make('tst-001-010'),
            copies: Deck.Copies.make(2),
          },
        ],
      },
    }

    scene(
      {
        update,
        view: withViewInputs(view, {
          collection: CollectionState.Model.Ready({
            owned: {},
            saves: {},
            nextRevision: 0,
          }),
          decks: DecksState.Model.Ready({
            decks: [withLegend],
            saves: {},
            nextRevision: 0,
            creation: DecksState.Creation.Idle(),
            removals: {},
          }),
        })(),
      },
      given(
        modifyFields(init(), {
          cards: () => ({
            [legend.cardId]: { id: legend.cardId, printings: [legend] },
            [testCard.id]: testCard,
          }),
        }),
      ),
      expect(role('list', { name: 'Your decks' })).toContainText('Fury'),
      expect(role('list', { name: 'Your decks' })).toContainText('Calm'),
      expect(role('list', { name: 'Your decks' })).toContainText(
        'Not finished',
      ),
      expect(text('Need 3')).toExist(),
    )
  })

  test('a new deck is created from its dialog and needs a name', () => {
    scene(
      { update, view: sceneView() },
      given(init()),
      click(role('button', { name: 'New deck' })),
      ...opened,
      click(role('button', { name: 'Create deck' })),
      expect(newForm).toContainText('Give the deck a name'),
      type(within(newForm, label('Name')), 'Jinx burn'),
      click(role('button', { name: 'Create deck' })),
      expectOutMessage(
        OutMessage.RequestedCreateDeck({
          name: Deck.DeckName.make('Jinx burn'),
          contents: Deck.empty,
        }),
      ),
      Command.resolve(
        Dialog.CloseDialog,
        Dialog.Message.CompletedCloseDialog(),
      ),
      Mount.expectEnded(Dialog.AcquireResources),
    )
  })

  test('an import that fails says why in its dialog', () => {
    scene(
      { update, view: sceneView() },
      given(init()),
      click(role('button', { name: 'Import code' })),
      ...opened,
      type(within(importForm, label('Name')), 'Imported'),
      type(label('Deck code'), 'NOTACODE'),
      click(role('button', { name: 'Import' })),
      Command.resolve(
        ReadDeckCode,
        Message.FailedReadDeckCode({
          problem: { _tag: 'UnknownCard', cardCode: 'OGN-200' },
        }),
      ),
      expect(importForm).toContainText('OGN-200 is not in the catalogue.'),
    )
  })
})
