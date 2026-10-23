import {
  Command,
  Mount,
  click,
  expect,
  given,
  role,
  scene,
  text,
} from 'foldkit/scene'
import { describe, test } from 'vitest'

import * as Dialog from './dialog'
import { initialModel, update, view } from './dialog.fixture'

const opened = [
  click(role('button', { name: 'Delete…' })),
  Command.resolve(Dialog.ShowDialog, Dialog.Message.SucceededShowDialog()),
  Mount.resolve(
    Dialog.AcquireResources,
    Dialog.Message.SucceededAcquireResources(),
  ),
]

const closed = [
  Command.resolve(Dialog.CloseDialog, Dialog.Message.CompletedCloseDialog()),
  Mount.expectEnded(Dialog.AcquireResources),
]

describe('Dialog', () => {
  test('opening shows the title, description and actions', () => {
    scene(
      { update, view },
      given(initialModel),
      ...opened,
      expect(role('heading', { name: 'Delete the wishlist?' })).toExist(),
      expect(text('This cannot be undone.')).toExist(),
      expect(role('button', { name: 'Delete' })).toExist(),
    )
  })

  test('Cancel closes without running the action', () => {
    scene(
      { update, view },
      given(initialModel),
      ...opened,
      click(role('button', { name: 'Cancel' })),
      ...closed,
      expect(role('heading', { name: 'Delete the wishlist?' })).not.toExist(),
      expect(text('Deleted 0')).toExist(),
    )
  })

  test('an action runs and the parent closes the dialog', () => {
    scene(
      { update, view },
      given(initialModel),
      ...opened,
      click(role('button', { name: 'Delete' })),
      Mount.expectEnded(Dialog.AcquireResources),
      ...closed,
      expect(text('Deleted 1')).toExist(),
    )
  })
})
