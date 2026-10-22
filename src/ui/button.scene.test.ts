import { click, expect, given, role, scene, text } from 'foldkit/scene'
import { modifyFields } from 'foldkit/struct'
import { describe, test } from 'vitest'

import { initialModel, update, view } from './button.fixture'

describe('Button', () => {
  test('clicking dispatches onClick', () => {
    scene(
      { update, view },
      given(initialModel),
      click(role('button', { name: 'Save' })),
      expect(text('Clicked 1')).toExist(),
    )
  })

  test('isDisabled marks the button disabled', () => {
    scene(
      { update, view },
      given(modifyFields(initialModel, { isDisabled: () => true })),
      expect(role('button', { name: 'Save' })).toBeDisabled(),
    )
  })

  test('type defaults to button and passes submit through', () => {
    scene(
      { update, view },
      given(initialModel),
      expect(role('button', { name: 'Save' })).toHaveAttr('type', 'button'),
      expect(role('button', { name: 'Submit' })).toHaveAttr('type', 'submit'),
    )
  })
})
