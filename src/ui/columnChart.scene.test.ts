import { expect, given, role, scene, selector, within } from 'foldkit/scene'
import { describe, test } from 'vitest'

import { initialModel, update, view } from './columnChart.fixture'

describe('ColumnChart', () => {
  test('each column is named by its description', () => {
    scene(
      { update, view },
      given(initialModel),
      expect(role('list', { name: 'Energy curve' })).toExist(),
      expect(role('listitem', { name: '3 energy: 8 cards' })).toExist(),
      expect(role('listitem', { name: '2 energy: no cards' })).toExist(),
    )
  })

  test('the tallest column fills the plot and an empty one has no bar', () => {
    scene(
      { update, view },
      given(initialModel),
      expect(
        within(
          role('listitem', { name: '3 energy: 8 cards' }),
          selector('[data-slot="bar"]'),
        ),
      ).toHaveStyle('height', '4rem'),
      expect(
        within(
          role('listitem', { name: '2 energy: no cards' }),
          selector('[data-slot="bar"]'),
        ),
      ).not.toExist(),
    )
  })
})
