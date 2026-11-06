import { click, expect, given, role, scene } from 'foldkit/scene'
import { describe, test } from 'vitest'

import { initialModel, update, view } from './disclosure.fixture'

describe('Disclosure', () => {
  test('clicking the summary opens and closes the panel', () => {
    scene(
      { update, view },
      given(initialModel),
      expect(role('button', { name: 'Filters' })).toHaveAttr(
        'aria-expanded',
        'false',
      ),
      click(role('button', { name: 'Filters' })),
      expect(role('button', { name: 'Filters' })).toHaveAttr(
        'aria-expanded',
        'true',
      ),
    )
  })
})
