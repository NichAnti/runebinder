import { Array, Option } from 'effect'
import {
  click,
  expect,
  expectOutMessage,
  given,
  role,
  scene,
  withViewInputs,
  within,
} from 'foldkit/scene'
import { modifyFields } from 'foldkit/struct'
import { describe, test } from 'vitest'

import { Collection, Deck, Printing, Wishlist } from '../../../../domain'
import { testCard } from '../../../../testing'
import * as WishlistState from '../../wishlist'
import { OutMessage } from './message'
import { init } from './model'
import type { Context } from './sections'
import { update } from './update'
import { view } from './view'

const base = Printing.PrintingId.make('tst-001-010')
const alternate = Printing.PrintingId.make('tst-001a-010')
const blueprintId = Printing.CardTraderBlueprintId.make(345245)
const withBlueprints: Printing.Card = {
  ...testCard,
  printings: Array.map(testCard.printings, printing => ({
    ...printing,
    maybeCardTraderBlueprintId: Option.some(
      printing.id === alternate
        ? blueprintId
        : Printing.CardTraderBlueprintId.make(345244),
    ),
  })),
}

const deck: Deck.Deck = {
  id: Deck.DeckId.make('7b0f2a7e-2a9c-4c6e-9d2b-6a6f1c9d2e11'),
  name: Deck.DeckName.make('Vi aggro'),
  contents: {
    ...Deck.empty,
    main: [{ printingId: alternate, copies: Deck.Copies.make(3) }],
  },
}

const context: Context = {
  decks: [deck],
  owned: { [alternate]: Collection.OwnedQuantity.make(1) },
  added: { [base]: Collection.OwnedQuantity.make(1) },
}

const readyWishlist = (sendings = {}) =>
  WishlistState.Model.Ready({
    added: context.added,
    maybeSentWishlistId: Option.none(),
    saves: {},
    nextRevision: 0,
    sendings,
  })

const sceneView = (wishlist: WishlistState.Model) =>
  withViewInputs(view, { isReady: true, hasFailed: false, context, wishlist })()

const loaded = modifyFields(init(), {
  cards: () => ({ [testCard.id]: withBlueprints }),
})
const deckSection = role('region', { name: 'Vi aggro' })
const customSection = role('region', { name: 'Custom wishlist' })

describe('wishlists page', () => {
  test('each deck lists what it misses, linked to the exact version', () => {
    scene(
      { update: update(context), view: sceneView(readyWishlist()) },
      given(loaded),
      expect(deckSection).toContainText('2× Test Unit, Tester'),
      expect(
        within(
          deckSection,
          role('link', { name: 'This version on CardTrader' }),
        ),
      ).toHaveAttr('href', Wishlist.cardTraderCardUrl(blueprintId)),
    )
  })

  test('a deck is sent to CardTrader under its name', () => {
    scene(
      { update: update(context), view: sceneView(readyWishlist()) },
      given(loaded),
      click(
        within(deckSection, role('button', { name: 'Send to CardTrader' })),
      ),
      expectOutMessage(
        OutMessage.RequestedSend({
          target: { _tag: 'Deck', deckId: deck.id, deckName: 'Vi aggro' },
          lines: [{ blueprintId, quantity: 2 }],
        }),
      ),
    )
  })

  test('only the custom wishlist can be changed by hand', () => {
    scene(
      { update: update(context), view: sceneView(readyWishlist()) },
      given(loaded),
      expect(
        within(deckSection, role('button', { name: 'Add one' })),
      ).not.toExist(),
      click(within(customSection, role('button', { name: 'Add one' }))),
      expectOutMessage(OutMessage.SteppedAdded({ printingId: base, step: 1 })),
    )
  })

  test('a send without a connected account points to the CardTrader page', () => {
    scene(
      {
        update: update(context),
        view: sceneView(
          readyWishlist({
            [WishlistState.CUSTOM_KEY]: WishlistState.Sending.Failed({
              reason: 'NotConnected',
            }),
          }),
        ),
      },
      given(loaded),
      expect(within(customSection, role('alert'))).toContainText(
        'Connect your CardTrader account first.',
      ),
    )
  })
})
