import { click, expect, given, role, scene } from 'foldkit/scene'
import { modifyFields } from 'foldkit/struct'
import { describe, test } from 'vitest'

import { initialModel, update, view } from './checkbox.fixture'

describe('Checkbox', () => {
  test('clicking toggles the checked state', () => {
    scene(
      { update, view },
      given(initialModel),
      expect(role('checkbox', { name: 'Remember on this device' })).toHaveAttr(
        'aria-checked',
        'false',
      ),
      click(role('checkbox', { name: 'Remember on this device' })),
      expect(role('checkbox', { name: 'Remember on this device' })).toHaveAttr(
        'aria-checked',
        'true',
      ),
    )
  })

  test('isDisabled marks the checkbox disabled', () => {
    scene(
      { update, view },
      given(modifyFields(initialModel, { isDisabled: () => true })),
      expect(
        role('checkbox', { name: 'Remember on this device' }),
      ).toBeDisabled(),
    )
  })
})
