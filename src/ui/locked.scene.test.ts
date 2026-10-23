import {
  click,
  expect,
  given,
  role,
  scene,
  selector,
  text,
} from 'foldkit/scene'
import { modifyFields } from 'foldkit/struct'
import { describe, test } from 'vitest'

import { initialModel, update, view } from './locked.fixture'

describe('Locked', () => {
  test('locked content is inert and the unlock button dispatches onUnlock', () => {
    scene(
      { update, view },
      given(initialModel),
      expect(selector('[data-slot="content"]')).toHaveAttr('inert', 'true'),
      click(role('button', { name: 'Connect CardTrader' })),
      expect(text('Unlocked 1, sent 0')).toExist(),
    )
  })

  test('unlocking does not run the locked action', () => {
    scene(
      { update, view },
      given(initialModel),
      click(role('button', { name: 'Connect CardTrader' })),
      expect(role('button', { name: 'Connect CardTrader' })).not.toExist(),
      click(role('button', { name: 'Send' })),
      expect(text('Unlocked 1, sent 1')).toExist(),
    )
  })

  test('unlocked content has no overlay', () => {
    scene(
      { update, view },
      given(modifyFields(initialModel, { isLocked: () => false })),
      expect(selector('[data-slot="overlay"]')).not.toExist(),
      expect(selector('[data-slot="content"]')).not.toHaveAttr('inert', 'true'),
    )
  })
})
