import { expect, given, role, scene } from 'foldkit/scene'
import { describe, test } from 'vitest'

import { initialModel, update, view } from './link.fixture'

describe('Link', () => {
  test('renders the href', () => {
    scene(
      { update, view },
      given(initialModel),
      expect(role('link', { name: 'About' })).toHaveAttr('href', '/about'),
    )
  })

  test('isCurrent marks the link as the current page', () => {
    scene(
      { update, view },
      given(initialModel),
      expect(role('link', { name: 'Home' })).toHaveAttr('aria-current', 'page'),
      expect(role('link', { name: 'About' })).not.toHaveAttr('aria-current'),
    )
  })

  test('an external link opens in a new tab', () => {
    scene(
      { update, view },
      given(initialModel),
      expect(role('link', { name: 'CardTrader' })).toHaveAttr(
        'target',
        '_blank',
      ),
      expect(role('link', { name: 'CardTrader' })).toHaveAttr(
        'rel',
        'noopener noreferrer',
      ),
      expect(role('link', { name: 'About' })).not.toHaveAttr('target'),
    )
  })
})
