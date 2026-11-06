import { click, expect, given, role, scene, text } from 'foldkit/scene'
import { modifyFields } from 'foldkit/struct'
import { describe, test } from 'vitest'

import { initialModel, update, view } from './iconButton.fixture'

describe('IconButton', () => {
  test('the label names the button and clicking dispatches its message', () => {
    scene(
      { update, view },
      given(initialModel),
      click(role('button', { name: 'Sync on CardTrader' })),
      expect(text('Synced 1')).toExist(),
    )
  })

  test('isDisabled marks the button disabled', () => {
    scene(
      { update, view },
      given(modifyFields(initialModel, { isDisabled: () => true })),
      expect(role('button', { name: 'Sync on CardTrader' })).toBeDisabled(),
    )
  })

  test('an external link is named and opens in a new tab', () => {
    scene(
      { update, view },
      given(initialModel),
      expect(role('link', { name: 'Open on CardTrader' })).toHaveAttr(
        'href',
        'https://www.cardtrader.com',
      ),
      expect(role('link', { name: 'Open on CardTrader' })).toHaveAttr(
        'target',
        '_blank',
      ),
      expect(role('link', { name: 'Open on CardTrader' })).toHaveAttr(
        'rel',
        'noopener noreferrer',
      ),
    )
  })
})
