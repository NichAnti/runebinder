import { Option } from 'effect'
import {
  click,
  expect,
  expectOutMessage,
  given,
  role,
  scene,
  text,
  withViewInputs,
} from 'foldkit/scene'
import { modifyFields } from 'foldkit/struct'
import { describe, test } from 'vitest'

import { CardTraderImport, Printing, Wishlist } from '../../../../domain'
import { testCard } from '../../../../testing'
import * as CardTraderWishlists from '../../cardTraderWishlists'
import { OutMessage } from './message'
import { init } from './model'
import { update } from './update'
import { type ViewInputs, view } from './view'

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

const remote: CardTraderImport.RemoteWishlist = {
  id: wishlistId,
  name: 'Bought at the fair',
  items: [],
}

const matched = modifyFields(init(), {
  maybeMatched: () =>
    Option.some({ wishlistId, lines, cards: { [testCard.id]: testCard } }),
})

const sceneView = (inputs: Partial<ViewInputs> = {}) =>
  withViewInputs(view, {
    wishlistId,
    maybeDetail: Option.some(
      CardTraderWishlists.Detail.Ready({ wishlist: remote }),
    ),
    isConnected: true,
    ...inputs,
  })()

describe('CardTrader wishlist page', () => {
  test('shows its lines and disables the ones not in the catalogue', () => {
    scene(
      { update, view: sceneView() },
      given(matched),
      expect(role('heading', { name: 'Bought at the fair' })).toExist(),
      expect(text('2× Test Unit, Tester')).toExist(),
      expect(text('TST · not in the catalogue')).toExist(),
      expect(role('checkbox', { name: 'Select missing' })).toBeDisabled(),
    )
  })

  test('only the matched lines can be selected to import', () => {
    scene(
      { update, view: sceneView() },
      given(matched),
      expect(
        role('button', { name: 'Import selected into the custom wishlist' }),
      ).not.toExist(),
      click(role('checkbox', { name: 'Select Test Unit, Tester' })),
      expect(
        role('button', { name: 'Import selected into the custom wishlist' }),
      ).toExist(),
    )
  })

  test('without CardTrader the page is locked behind connecting', () => {
    scene(
      { update, view: sceneView({ isConnected: false }) },
      given(init()),
      click(role('button', { name: 'Connect CardTrader' })),
      expectOutMessage(OutMessage.RequestedConnect()),
    )
  })

  test('a failed load can be retried', () => {
    scene(
      {
        update,
        view: sceneView({
          maybeDetail: Option.some(
            CardTraderWishlists.Detail.Failed({ reason: 'Unavailable' }),
          ),
        }),
      },
      given(init()),
      click(role('button', { name: 'Try again' })),
      expectOutMessage(OutMessage.RequestedRetry()),
    )
  })
})
