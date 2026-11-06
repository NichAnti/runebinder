import { change, expect, given, label, scene, text } from 'foldkit/scene'
import { describe, test } from 'vitest'

import { initialModel, update, view } from './select.fixture'

describe('Select', () => {
  test('choosing an option reports its value', () => {
    scene(
      { update, view },
      given(initialModel),
      change(label('Sort by'), 'energy'),
      expect(text('Sorted by energy')).toExist(),
    )
  })
})
