import { Array, Option } from 'effect'
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
  selector,
  text,
  withViewInputs,
  within,
} from 'foldkit/scene'
import { modifyFields } from 'foldkit/struct'
import { describe, test } from 'vitest'

import { Collection, Deck, Printing, Wishlist } from '../../../../domain'
import { testCard } from '../../../../testing'
import { Dialog } from '../../../../ui'
import * as CardTraderWishlists from '../../cardTraderWishlists'
import * as WishlistState from '../../wishlist'
import { OutMessage } from './message'
import { init } from './model'
import type { Context } from './sections'
import { update } from './update'
import { type Focus, view } from './view'

const base = Printing.PrintingId.make('tst-001-010')
const alternate = Printing.PrintingId.make('tst-001a-010')
const blueprintId = Printing.CardTraderBlueprintId.make(345245)
const withBlueprints: Printing.Card = {
  ...testCard,
  printings: Array.map(testCard.printings, printing => ({
    ...printing,
    maybeCardTrader: Option.some({
      id:
        printing.id === alternate
          ? blueprintId
          : Printing.CardTraderBlueprintId.make(345244),
      metaName: Printing.CardTraderSlug.make('test-card'),
      expansionCode: Printing.CardTraderExpansionCode.make('tst'),
    }),
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

const linkedId = Wishlist.CardTraderWishlistId.make(3572164)
const otherId = Wishlist.CardTraderWishlistId.make(3572170)

const readyWishlist = (links = {}) =>
  WishlistState.Model.Ready({
    added: context.added,
    links,
    saves: {},
    nextRevision: 0,
    operations: {},
  })

const listed = CardTraderWishlists.Listing.Ready({
  wishlists: [
    { id: linkedId, name: 'Vi aggro (Runebinder)' },
    { id: otherId, name: 'Old deck (Runebinder)' },
  ],
})

type Inputs = Readonly<{
  focus?: Focus
  wishlist?: WishlistState.Model
  isConnected?: boolean
  listing?: CardTraderWishlists.Listing
}>

const sceneView = ({
  focus = { _tag: 'All' },
  wishlist = readyWishlist(),
  isConnected = true,
  listing = CardTraderWishlists.Listing.NotLoaded(),
}: Inputs = {}) =>
  withViewInputs(view, {
    focus,
    isReady: true,
    hasFailed: false,
    context,
    wishlist,
    isConnected,
    remote: { ...CardTraderWishlists.init(), listing },
  })()

const loaded = modifyFields(init(), {
  cards: () => ({ [testCard.id]: withBlueprints }),
})
const deckRow = role('listitem', { name: /Vi aggro/ })
const deckFocus: Focus = {
  _tag: 'One',
  wishlist: Wishlist.deckWishlist(deck.id),
}
const customFocus: Focus = { _tag: 'One', wishlist: Wishlist.CUSTOM }

const openedConfirm = [
  Command.resolve(Dialog.ShowDialog, Dialog.Message.SucceededShowDialog()),
  Mount.resolve(
    Dialog.AcquireResources,
    Dialog.Message.SucceededAcquireResources(),
  ),
]

const closedConfirm = [
  Command.resolve(Dialog.CloseDialog, Dialog.Message.CompletedCloseDialog()),
  Mount.expectEnded(Dialog.AcquireResources),
]

describe('wishlists page', () => {
  test('lists each deck and the custom wishlist with their copies', () => {
    scene(
      { update: update(context), view: sceneView() },
      given(loaded),
      expect(role('link', { name: 'Vi aggro' })).toHaveAttr(
        'href',
        `/wishlists/${deck.id}`,
      ),
      expect(role('link', { name: 'Custom wishlist' })).toHaveAttr(
        'href',
        '/wishlists/custom',
      ),
      expect(text('2 copies')).toExist(),
    )
  })

  test('without CardTrader the actions are locked behind connecting', () => {
    scene(
      { update: update(context), view: sceneView({ isConnected: false }) },
      given(loaded),
      expect(within(deckRow, selector('[data-slot="content"]'))).toHaveAttr(
        'inert',
        'true',
      ),
      click(
        within(
          role('region', { name: 'On CardTrader' }),
          role('button', { name: 'Connect CardTrader' }),
        ),
      ),
      expectOutMessage(OutMessage.RequestedConnect()),
    )
  })

  test('a deck is created on CardTrader under its name', () => {
    scene(
      { update: update(context), view: sceneView() },
      given(loaded),
      click(role('button', { name: 'Create Vi aggro on CardTrader' })),
      expectOutMessage(
        OutMessage.RequestedCreate({
          wishlist: Wishlist.deckWishlist(deck.id),
          name: 'Vi aggro (Runebinder)',
          lines: [{ blueprintId, quantity: 2 }],
        }),
      ),
    )
  })

  test('syncing a linked wishlist asks first', () => {
    scene(
      {
        update: update(context),
        view: sceneView({
          wishlist: readyWishlist({ [deck.id]: linkedId }),
          listing: listed,
        }),
      },
      given(loaded),
      expect(text('On CardTrader')).toExist(),
      expect(role('link', { name: 'Open Vi aggro on CardTrader' })).toHaveAttr(
        'href',
        Wishlist.cardTraderWishlistUrl(linkedId),
      ),
      click(role('button', { name: 'Sync Vi aggro on CardTrader' })),
      ...openedConfirm,
      expect(role('heading', { name: /Sync “Vi aggro”/ })).toExist(),
      click(role('button', { name: 'Sync' })),
      expectOutMessage(
        OutMessage.RequestedSync({
          wishlist: Wishlist.deckWishlist(deck.id),
          name: 'Vi aggro (Runebinder)',
          lines: [{ blueprintId, quantity: 2 }],
        }),
      ),
      ...closedConfirm,
    )
  })

  test('other CardTrader wishlists are listed and can be deleted', () => {
    scene(
      {
        update: update(context),
        view: sceneView({
          wishlist: readyWishlist({ [deck.id]: linkedId }),
          listing: listed,
        }),
      },
      given(loaded),
      expect(
        within(
          role('list', { name: 'Wishlists on CardTrader' }),
          role('link', { name: 'Vi aggro (Runebinder)' }),
        ),
      ).not.toExist(),
      expect(role('link', { name: 'Old deck (Runebinder)' })).toHaveAttr(
        'href',
        `/cardtrader/wishlists/${otherId}`,
      ),
      expect(text('Made by this app')).toExist(),
      click(
        role('button', {
          name: 'Delete Old deck (Runebinder) on CardTrader',
        }),
      ),
      ...openedConfirm,
      click(role('button', { name: 'Delete' })),
      expectOutMessage(
        OutMessage.RequestedDeleteRemote({ wishlistId: otherId }),
      ),
      ...closedConfirm,
      Mount.expectEnded(Dialog.AcquireResources),
    )
  })

  test("a deck's page lists what it misses, linked to the exact version", () => {
    scene(
      { update: update(context), view: sceneView({ focus: deckFocus }) },
      given(loaded),
      expect(role('heading', { name: /Vi aggro/ })).toExist(),
      expect(text('Need 2')).toExist(),
      expect(
        role('link', {
          name: 'Open this version of Test Unit, Tester on CardTrader',
        }),
      ).toHaveAttr('href', Wishlist.cardTraderCardUrl(blueprintId)),
      expect(role('button', { name: 'Add one' })).not.toExist(),
    )
  })

  test('only the custom wishlist can be changed by hand', () => {
    scene(
      { update: update(context), view: sceneView({ focus: customFocus }) },
      given(loaded),
      click(role('button', { name: 'Add one' })),
      expectOutMessage(OutMessage.SteppedAdded({ printingId: base, step: 1 })),
    )
  })

  test('a custom card can be removed at once', () => {
    scene(
      { update: update(context), view: sceneView({ focus: customFocus }) },
      given(loaded),
      expect(role('checkbox', { name: 'Select Test Unit, Tester' })).toExist(),
      expect(text('Select Test Unit, Tester')).toHaveClass('sr-only'),
      click(role('button', { name: 'Remove Test Unit, Tester' })),
      expectOutMessage(OutMessage.RemovedAdded({ printingId: base })),
    )
  })

  test('the bought bar counts the selected cards', () => {
    scene(
      { update: update(context), view: sceneView({ focus: customFocus }) },
      given(loaded),
      expect(
        role('button', { name: 'Mark selected as bought' }),
      ).toBeDisabled(),
      click(role('checkbox', { name: 'Select Test Unit, Tester' })),
      expect(role('group', { name: 'Bought' })).toContainText('1 selected'),
      expect(role('button', { name: 'Mark selected as bought' })).toBeEnabled(),
      expect(
        role('button', { name: 'Mark Test Unit, Tester as bought' }),
      ).toExist(),
    )
  })

  test('the version that arrived can be chosen when there are several', () => {
    scene(
      { update: update(context), view: sceneView({ focus: customFocus }) },
      given(loaded),
      expect(label('Arrived as')).toExist(),
    )
  })

  test('the page of a deleted deck says so', () => {
    scene(
      {
        update: update(context),
        view: sceneView({
          focus: {
            _tag: 'One',
            wishlist: Wishlist.deckWishlist(
              Deck.DeckId.make('2b9c7d4e-8f1a-4c3b-a5e6-d7f8091a2b3c'),
            ),
          },
        }),
      },
      given(loaded),
      expect(text('This wishlist does not exist')).toExist(),
    )
  })
})
