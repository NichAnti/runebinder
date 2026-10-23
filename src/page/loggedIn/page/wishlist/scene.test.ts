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

import { Printing, Wishlist } from '../../../../domain'
import { testCard } from '../../../../testing'
import * as WishlistState from '../../wishlist'
import { OutMessage } from './message'
import { init } from './model'
import { type Context, update } from './update'
import { view } from './view'

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

const context: Context = {
  needs: [{ printingId: alternate, needed: 3, owned: 1, missing: 2 }],
  added: {},
}

const readyWishlist = WishlistState.Model.Ready({
  added: {},
  maybeSentWishlistId: Option.none(),
  saves: {},
  nextRevision: 0,
  sending: WishlistState.Sending.Idle(),
})

const inputs = (wishlist: WishlistState.Model) =>
  withViewInputs(view, { isReady: true, hasFailed: false, context, wishlist })()

const loaded = modifyFields(init(), {
  cards: () => ({ [testCard.id]: withBlueprints }),
})
const wanted = role('list', { name: 'Wanted cards' })

describe('wishlist page', () => {
  test('a missing card links to its exact version on CardTrader', () => {
    scene(
      { update: update(context), view: inputs(readyWishlist) },
      given(loaded),
      expect(wanted).toContainText('Missing from decks 2'),
      expect(
        within(wanted, role('link', { name: 'This version on CardTrader' })),
      ).toHaveAttr('href', Wishlist.cardTraderCardUrl(blueprintId)),
    )
  })

  test('a card can be wanted by hand on top of what decks miss', () => {
    scene(
      { update: update(context), view: inputs(readyWishlist) },
      given(loaded),
      click(within(wanted, role('button', { name: 'Add one' }))),
      expectOutMessage(
        OutMessage.SteppedAdded({ printingId: alternate, step: 1 }),
      ),
    )
  })

  test('sending asks for one line per card and set', () => {
    scene(
      { update: update(context), view: inputs(readyWishlist) },
      given(loaded),
      click(role('button', { name: 'Send to CardTrader' })),
      expectOutMessage(
        OutMessage.RequestedSend({
          name: 'Riftbound decks (from cardtrader app)',
          lines: [{ blueprintId, quantity: 2 }],
        }),
      ),
    )
  })

  test('a send without a connected account points to the CardTrader page', () => {
    scene(
      {
        update: update(context),
        view: inputs(
          WishlistState.Model.Ready({
            added: {},
            maybeSentWishlistId: Option.none(),
            saves: {},
            nextRevision: 0,
            sending: WishlistState.Sending.Failed({ reason: 'NotConnected' }),
          }),
        ),
      },
      given(loaded),
      expect(role('alert')).toContainText(
        'Connect your CardTrader account first.',
      ),
      expect(role('link', { name: 'Connect CardTrader' })).toHaveAttr(
        'href',
        '/cardtrader',
      ),
    )
  })
})
