import { click, expect, given, role, scene, within } from 'foldkit/scene'
import { describe, test } from 'vitest'

import { MAX, initialModel, update, view } from './quantityStepper.fixture'

const stepper = role('group', { name: 'Owned: Vi, Standard' })

describe('QuantityStepper', () => {
  test('adds and removes one at a time within its bounds', () => {
    scene(
      { update, view },
      given(initialModel),
      expect(
        within(stepper, role('button', { name: 'Remove one' })),
      ).toBeDisabled(),
      click(role('button', { name: 'Add one' })),
      click(role('button', { name: 'Add one' })),
      expect(within(stepper, role('status'))).toHaveText('2'),
      click(role('button', { name: 'Remove one' })),
      expect(within(stepper, role('status'))).toHaveText('1'),
    )
  })

  test('cannot go above its maximum', () => {
    scene(
      { update, view },
      given({ quantity: MAX }),
      expect(role('button', { name: 'Add one' })).toBeDisabled(),
    )
  })
})
