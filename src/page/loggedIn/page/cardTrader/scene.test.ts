import {
  Command,
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

import { Message } from './message'
import { Connection, init } from './model'
import { ConnectCardTrader, ForgetCardTraderToken, update } from './update'
import { view } from './view'

const disconnected = modifyFields(init(), {
  connection: () => Connection.Disconnected(),
})

describe('CardTrader page', () => {
  test('warns that the token gives full account access', () => {
    scene(
      { update, view },
      given(disconnected),
      expect(text(/full access to your CardTrader account/)).toExist(),
      expect(label('API token')).toHaveAttr('type', 'password'),
    )
  })

  test('a malformed token shows an error and sends nothing', () => {
    scene(
      { update, view },
      given(disconnected),
      type(label('API token'), 'short'),
      click(role('button', { name: 'Connect' })),
      Command.expectNone(),
      expect(text('This does not look like a CardTrader API token')).toExist(),
    )
  })

  test('connecting with a remembered token shows the connection', () => {
    scene(
      { update, view },
      given(disconnected),
      type(label('API token'), 'test.token-0123456789abcdef'),
      click(role('checkbox', { name: 'Remember on this device' })),
      click(role('button', { name: 'Connect' })),
      expect(role('button', { name: 'Connecting…' })).toBeDisabled(),
      Command.expectExact(ConnectCardTrader),
      Command.resolve(
        ConnectCardTrader,
        Message.SucceededConnectCardTrader({
          appName: 'Deck app',
          isRemembered: true,
        }),
      ),
      expect(role('status')).toContainText('Deck app'),
      expect(role('status')).toContainText('remembered on this device'),
    )
  })

  test('a rejected token shows why', () => {
    scene(
      { update, view },
      given(disconnected),
      type(label('API token'), 'test.token-0123456789abcdef'),
      click(role('button', { name: 'Connect' })),
      Command.resolve(
        ConnectCardTrader,
        Message.FailedConnectCardTrader({ reason: 'InvalidToken' }),
      ),
      expect(role('alert')).toContainText('CardTrader rejected this token'),
    )
  })

  test('disconnecting returns to the form', () => {
    scene(
      { update, view },
      given(
        modifyFields(init(), {
          connection: () =>
            Connection.Connected({ appName: 'Deck app', isRemembered: false }),
        }),
      ),
      click(role('button', { name: 'Disconnect' })),
      Command.resolve(
        ForgetCardTraderToken,
        Message.CompletedForgetCardTraderToken(),
      ),
      expect(label('API token')).toExist(),
    )
  })
})
