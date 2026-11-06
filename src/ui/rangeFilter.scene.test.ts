import { expect, given, label, scene, text, type } from 'foldkit/scene'
import { describe, test } from 'vitest'

import { initialModel, update, view } from './rangeFilter.fixture'

describe('RangeFilter', () => {
  test('typing a bound reports it as a number', () => {
    scene(
      { update, view },
      given(initialModel),
      type(label('Minimum Energy'), '2'),
      type(label('Maximum Energy'), '5'),
      expect(text('From 2 to 5')).toExist(),
    )
  })

  test('clearing a bound reports no bound', () => {
    scene(
      { update, view },
      given(initialModel),
      type(label('Minimum Energy'), '2'),
      type(label('Minimum Energy'), ''),
      expect(text('From any to any')).toExist(),
    )
  })
})
