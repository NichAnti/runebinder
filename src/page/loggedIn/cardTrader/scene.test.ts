import type { Html, HtmlBuilder } from 'foldkit/html'
import {
  Command,
  Mount,
  click,
  expect,
  given,
  label,
  role,
  scene,
  text,
  type,
} from 'foldkit/scene'
import { modifyFields } from 'foldkit/struct'
import { describe, test } from 'vitest'

import { Dialog } from '../../../ui'
import { view as settingsView } from '../page/cardTrader'
import { Message } from './message'
import { Connection, type Model, init } from './model'
import { ConnectCardTrader, update } from './update'
import { view as dialogView } from './view'

const disconnected = modifyFields(init(), {
  connection: () => Connection.Disconnected({ wasRejected: false }),
})

const view = (model: Model, h: HtmlBuilder<Message>): Html =>
  h.div([], [settingsView(model, h), dialogView(model, h)])

const opened = [
  click(role('button', { name: 'Connect CardTrader' })),
  Command.resolve(Dialog.ShowDialog, Dialog.Message.SucceededShowDialog()),
  Mount.resolve(
    Dialog.AcquireResources,
    Dialog.Message.SucceededAcquireResources(),
  ),
]

describe('connect CardTrader', () => {
  test('the dialog warns that the token gives full account access', () => {
    scene(
      { update, view },
      given(disconnected),
      ...opened,
      expect(role('heading', { name: 'Connect CardTrader' })).toExist(),
      expect(text(/full access to your CardTrader account/)).toExist(),
      expect(label('API token')).toHaveAttr('type', 'password'),
    )
  })

  test('a malformed token shows an error and sends nothing', () => {
    scene(
      { update, view },
      given(disconnected),
      ...opened,
      type(label('API token'), 'short'),
      click(role('button', { name: 'Connect' })),
      Command.expectNone(),
      expect(text('This does not look like a CardTrader API token')).toExist(),
    )
  })

  test('connecting closes the dialog and shows the connection', () => {
    scene(
      { update, view },
      given(disconnected),
      ...opened,
      type(label('API token'), 'test.token-0123456789abcdef'),
      click(role('checkbox', { name: 'Remember on this device' })),
      click(role('button', { name: 'Connect' })),
      expect(role('button', { name: 'Connecting…' })).toBeDisabled(),
      Command.resolve(
        ConnectCardTrader,
        Message.SucceededConnectCardTrader({
          appName: 'Deck app',
          isRemembered: true,
        }),
      ),
      Command.resolve(
        Dialog.CloseDialog,
        Dialog.Message.CompletedCloseDialog(),
      ),
      Mount.expectEnded(Dialog.AcquireResources),
      expect(role('heading', { name: 'Connect CardTrader' })).not.toExist(),
      expect(role('status')).toContainText('Deck app'),
      expect(role('status')).toContainText('remembered on this device'),
    )
  })

  test('a rejected token shows why', () => {
    scene(
      { update, view },
      given(disconnected),
      ...opened,
      type(label('API token'), 'test.token-0123456789abcdef'),
      click(role('button', { name: 'Connect' })),
      Command.resolve(
        ConnectCardTrader,
        Message.FailedConnectCardTrader({ reason: 'InvalidToken' }),
      ),
      expect(role('alert')).toContainText('CardTrader rejected this token'),
    )
  })

  test('a token rejected later asks to connect again', () => {
    scene(
      { update, view },
      given(
        modifyFields(init(), {
          connection: () => Connection.Disconnected({ wasRejected: true }),
        }),
      ),
      expect(role('alert')).toContainText('CardTrader rejected your token'),
    )
  })
})
