import { click, expect, given, role, scene } from 'foldkit/scene'
import { describe, test } from 'vitest'

import { initialModel, update, view } from './filterChip.fixture'

describe('FilterChip', () => {
  test('clicking toggles the pressed state', () => {
    scene(
      { update, view },
      given(initialModel),
      expect(role('button', { name: 'Fury 12' })).toHaveAttr(
        'aria-pressed',
        'false',
      ),
      click(role('button', { name: 'Fury 12' })),
      expect(role('button', { name: 'Fury 12' })).toHaveAttr(
        'aria-pressed',
        'true',
      ),
    )
  })

  test('a value with no results is disabled', () => {
    scene(
      { update, view },
      given(initialModel),
      expect(role('button', { name: 'Empty 0' })).toBeDisabled(),
    )
  })
})
