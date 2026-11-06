import { Command, click, expect, given, role, scene, text } from 'foldkit/scene'
import { describe, test } from 'vitest'

import * as Tabs from './tabs'
import { initialModel, update, view } from './tabs.fixture'

describe('Tabs', () => {
  test('shows the selected panel and switches on click', () => {
    scene(
      { update, view },
      given(initialModel),
      expect(role('tab', { name: 'Deck stats' })).toHaveAttr(
        'aria-selected',
        'true',
      ),
      expect(text('Stats panel')).toExist(),
      click(role('tab', { name: 'Add cards' })),
      Command.resolve(Tabs.FocusTab, Tabs.Message.CompletedFocusTab()),
      expect(text('Add panel')).toExist(),
      expect(text('Stats panel')).not.toExist(),
    )
  })

  test('the parent can select a tab', () => {
    scene(
      { update, view },
      given(initialModel),
      click(role('button', { name: 'Jump to add' })),
      expect(role('tab', { name: 'Add cards' })).toHaveAttr(
        'aria-selected',
        'true',
      ),
      expect(role('tabpanel')).toContainText('Add panel'),
    )
  })
})
