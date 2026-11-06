import { expect, given, role, scene, text } from 'foldkit/scene'
import { describe, test } from 'vitest'

import { initialModel, update, view } from './cardTile.fixture'

describe('CardTile', () => {
  test('shows the card name and describes its image', () => {
    scene(
      { update, view },
      given(initialModel),
      expect(text('Test Unit')).toExist(),
      expect(role('img', { name: 'Test Unit artwork' })).toHaveAttr(
        'loading',
        'lazy',
      ),
    )
  })
})

describe('CardTile highlight', () => {
  test('every highlight and the meta are shown', () => {
    scene(
      { update, view },
      given(initialModel),
      expect(text('Owned 3')).toExist(),
      expect(text('Need 1')).toExist(),
      expect(text('1 printing')).toExist(),
    )
  })
})

describe('Notice', () => {
  test('an informational notice is a status, an error is an alert', () => {
    scene(
      { update, view },
      given(initialModel),
      expect(role('status')).toContainText('Loading'),
      expect(role('alert')).toContainText('Failed'),
    )
  })
})
