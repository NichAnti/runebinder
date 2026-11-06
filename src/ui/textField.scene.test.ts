import { expect, given, label, role, scene, text, type } from 'foldkit/scene'
import { describe, test } from 'vitest'

import { initialModel, update, view } from './textField.fixture'

describe('TextField', () => {
  test('the label names the input', () => {
    scene(
      { update, view },
      given(initialModel),
      expect(label('Email')).toHaveAttr('type', 'email'),
    )
  })

  test('an invalid value shows its error and marks the input invalid', () => {
    scene(
      { update, view },
      given(initialModel),
      type(label('Email'), 'nope'),
      expect(text('Enter a valid email')).toExist(),
      expect(role('textbox', { name: 'Email' })).toHaveAttr(
        'aria-invalid',
        'true',
      ),
    )
  })
})
