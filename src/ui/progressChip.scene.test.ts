import { click, expect, given, role, scene, text } from 'foldkit/scene'
import { describe, test } from 'vitest'

import { initialModel, update, view } from './progressChip.fixture'

describe('ProgressChip', () => {
  test('the status is part of the name, not only the colour', () => {
    scene(
      { update, view },
      given(initialModel),
      expect(role('button', { name: 'Main 32/40, not finished' })).toExist(),
      expect(role('button', { name: 'Runes 12/12, done' })).toExist(),
      expect(
        role('button', { name: 'Battlefields 4/3, has a problem' }),
      ).toExist(),
    )
  })

  test('clicking dispatches onClick', () => {
    scene(
      { update, view },
      given(initialModel),
      click(role('button', { name: /^Runes/ })),
      expect(text('Jumped to Runes')).toExist(),
    )
  })
})
