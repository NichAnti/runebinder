import {
  Mount,
  click,
  expect,
  given,
  keydown,
  role,
  scene,
} from 'foldkit/scene'
import { describe, test } from 'vitest'

import {
  Message,
  PlacePanel,
  initialModel,
  update,
  view,
} from './hoverCard.fixture'

const trigger = role('button', { name: 'Vi' })
const panel = role('dialog', { name: 'Vi' })

describe('HoverCard', () => {
  test('the trigger opens the panel and Escape closes it', () => {
    scene(
      { update, view },
      given(initialModel),
      expect(trigger).toHaveAttr('aria-expanded', 'false'),
      click(trigger),
      Mount.resolve(PlacePanel, Message.CompletedPlacePanel()),
      expect(trigger).toHaveAttr('aria-expanded', 'true'),
      expect(panel).toContainText('Every printing of Vi'),
      keydown(panel, 'Escape'),
      Mount.expectEnded(PlacePanel),
      expect(panel).not.toExist(),
    )
  })

  test('a click outside a pinned panel closes it', () => {
    scene(
      { update, view },
      given(initialModel),
      click(trigger),
      Mount.resolve(PlacePanel, Message.CompletedPlacePanel()),
      click('[data-slot="backdrop"]'),
      Mount.expectEnded(PlacePanel),
      expect(panel).not.toExist(),
    )
  })
})
