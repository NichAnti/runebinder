import { Option } from 'effect'
import { expect, given, role, scene, text, withViewInputs } from 'foldkit/scene'
import { describe, test } from 'vitest'

import { Printing } from '../../../../domain'
import { AppRoute } from '../../../../route'
import { testCard } from '../../../../testing'
import { CardState } from './model'
import { update } from './update'
import { view } from './view'

const routeFor = (maybePrinting: Option.Option<string>) =>
  AppRoute.Card({
    cardId: testCard.id,
    printing: Option.map(maybePrinting, Printing.PrintingId.make),
  })

const found = { state: CardState.Found({ card: testCard }) }

describe('card page', () => {
  test('shows the base printing with its rules text', () => {
    scene(
      {
        update,
        view: withViewInputs(view, { route: routeFor(Option.none()) })(),
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

  test('an unknown card says so', () => {
    scene(
      {
        update,
        view: withViewInputs(view, { route: routeFor(Option.none()) })(),
      },
      given({ state: CardState.Missing({ cardId: testCard.id }) }),
      expect(role('status')).toContainText('Card not found'),
    )
  })
})
