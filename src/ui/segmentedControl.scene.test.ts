import { click, expect, given, role, scene } from 'foldkit/scene'
import { describe, test } from 'vitest'

import { initialModel, update, view } from './segmentedControl.fixture'

describe('SegmentedControl', () => {
  test('exactly one choice is pressed and clicking moves it', () => {
    scene(
      { update, view },
      given(initialModel),
      expect(role('button', { name: 'Grid' })).toHaveAttr(
        'aria-pressed',
        'true',
      ),
      expect(role('button', { name: 'List' })).toHaveAttr(
        'aria-pressed',
        'false',
      ),
      click(role('button', { name: 'List' })),
      expect(role('button', { name: 'List' })).toHaveAttr(
        'aria-pressed',
        'true',
      ),
      expect(role('button', { name: 'Grid' })).toHaveAttr(
        'aria-pressed',
        'false',
      ),
    )
  })
})
