import { Option } from 'effect'
import {
  click,
  expect,
  expectOutMessage,
  given,
  role,
  scene,
  selector,
  text,
  withViewInputs,
  within,
} from 'foldkit/scene'
import { describe, test } from 'vitest'

import { Collection, Printing } from '../../../../domain'
import { AppRoute } from '../../../../route'
import { testCard } from '../../../../testing'
import * as CollectionState from '../../collection'
import * as WishlistState from '../../wishlist'
import { OutMessage } from './message'
import { CardState } from './model'
import { update } from './update'
import { view } from './view'

const routeFor = (maybePrinting: Option.Option<string>) =>
  AppRoute.Card({
    cardId: testCard.id,
    printing: Option.map(maybePrinting, Printing.PrintingId.make),
  })

const found = { state: CardState.Found({ card: testCard }) }
const collection = CollectionState.init()
const ready = CollectionState.Model.Ready({
  owned: {
    [Printing.PrintingId.make('tst-001a-010')]:
      Collection.OwnedQuantity.make(2),
  },
  saves: {},
  nextRevision: 0,
  refresh: CollectionState.Refresh.Idle(),
})

describe('card page', () => {
  test('shows the base printing with its rules text', () => {
    scene(
      {
        update,
        view: withViewInputs(view, {
          wishlist: WishlistState.init(),
          collection,
          route: routeFor(Option.none()),
        })(),
      },
      given(found),
      expect(role('heading', { name: /Test Unit/ })).toExist(),
      expect(role('img', { name: 'Test Unit artwork' })).toHaveAttr(
        'src',
        'https://example.com/test-unit.png',
      ),
      expect(text('Tank')).toExist(),
      expect(text('1 energy')).toExist(),
      expect(text('Fury rune')).toExist(),
    )
  })

  test('the printing in the URL is shown and marked current', () => {
    scene(
      {
        update,
        view: withViewInputs(view, {
          wishlist: WishlistState.init(),
          collection,
          route: routeFor(Option.some('tst-001a-010')),
        })(),
      },
      given(found),
      expect(role('img', { name: 'Test Unit artwork' })).toHaveAttr(
        'src',
        'https://example.com/test-unit-alt.png',
      ),
      expect(role('link', { name: /Alternate art/ })).toHaveAttr(
        'aria-current',
        'page',
      ),
    )
  })

  test('shows how many of each printing are owned and steps them', () => {
    scene(
      {
        update,
        view: withViewInputs(view, {
          wishlist: WishlistState.init(),
          collection: ready,
          route: routeFor(Option.none()),
        })(),
      },
      given(found),
      expect(text('You own 2.')).toExist(),
      expect(
        within(
          role('group', { name: 'Owned: Alternate art TST-001a/010' }),
          role('status'),
        ),
      ).toHaveText('2'),
      click(
        within(
          role('group', { name: 'Owned: Standard TST-001/010' }),
          role('button', { name: 'Add one' }),
        ),
      ),
      expectOutMessage(
        OutMessage.SteppedQuantity({
          printingId: Printing.PrintingId.make('tst-001-010'),
          step: 1,
        }),
      ),
    )
  })

  test('every printing is listed with its own image', () => {
    scene(
      {
        update,
        view: withViewInputs(view, {
          wishlist: WishlistState.init(),
          collection,
          route: routeFor(Option.none()),
        })(),
      },
      given(found),
      expect(
        within(role('link', { name: /Alternate art/ }), selector('img')),
      ).toHaveAttr('src', 'https://example.com/test-unit-alt.png'),
      expect(
        within(role('link', { name: /Standard/ }), selector('img')),
      ).toHaveAttr('src', 'https://example.com/test-unit.png'),
    )
  })

  test('a collection that failed to load can be retried', () => {
    scene(
      {
        update,
        view: withViewInputs(view, {
          wishlist: WishlistState.init(),
          collection: CollectionState.Model.Failed(),
          route: routeFor(Option.none()),
        })(),
      },
      given(found),
      expect(role('alert')).toContainText('could not be loaded'),
      click(role('button', { name: 'Try again' })),
      expectOutMessage(OutMessage.RequestedCollectionRetry()),
    )
  })

  test('an unknown card says so', () => {
    scene(
      {
        update,
        view: withViewInputs(view, {
          wishlist: WishlistState.init(),
          collection,
          route: routeFor(Option.none()),
        })(),
      },
      given({ state: CardState.Missing({ cardId: testCard.id }) }),
      expect(role('status')).toContainText('Card not found'),
    )
  })
})
