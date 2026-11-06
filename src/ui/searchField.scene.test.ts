import { expect, given, label, scene, text, type } from 'foldkit/scene'
import { describe, test } from 'vitest'

import { initialModel, update, view } from './searchField.fixture'

describe('SearchField', () => {
  test('typing reports the new value', () => {
    scene(
      { update, view },
      given(initialModel),
      type(label('Search cards'), 'vi'),
      expect(text('Searching for vi')).toExist(),
    )
  })

  test('is a search input', () => {
    scene(
      { update, view },
      given(initialModel),
      expect(label('Search cards')).toHaveAttr('type', 'search'),
    )
  })
})
