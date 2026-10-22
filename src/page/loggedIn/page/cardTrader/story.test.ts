import { Option, Redacted } from 'effect'
import { Command, given, message, model, story } from 'foldkit/story'
import { modifyFields } from 'foldkit/struct'
import { describe, expect, test } from 'vitest'

import { Message } from './message'
import { Connection, init } from './model'
import {
  CheckStoredToken,
  ConnectCardTrader,
  ForgetCardTraderToken,
  enter,
  update,
} from './update'

const disconnected = modifyFields(init(), {
  connection: () => Connection.Disconnected(),
})

const withToken = (raw: string) =>
  modifyFields(disconnected, { tokenInput: () => Redacted.make(raw) })

describe('connect CardTrader', () => {
  test('entering the page checks the stored token', () => {
    const { model: next, commands = [] } = enter(disconnected)

    expect(next.connection).toStrictEqual(Connection.Checking())
    expect(commands.map(command => command.name)).toStrictEqual([
      CheckStoredToken.name,
    ])
  })

  test('a stored token that still works shows the connection', () => {
    story(
      update,
      given(init()),
      message(
        Message.SucceededCheckStoredToken({
          appName: 'Deck app',
          isRemembered: true,
        }),
      ),
      model(next => {
        expect(next.connection).toStrictEqual(
          Connection.Connected({ appName: 'Deck app', isRemembered: true }),
        )
      }),
    )
  })

  test('a stored token CardTrader rejects is forgotten', () => {
    story(
      update,
      given(init()),
      message(Message.FailedCheckStoredToken({ reason: 'InvalidToken' })),
      model(next => {
        expect(next.connection).toStrictEqual(
          Connection.Failed({ reason: 'InvalidToken' }),
        )
      }),
      Command.expectExact(ForgetCardTraderToken),
      Command.resolve(
        ForgetCardTraderToken,
        Message.CompletedForgetCardTraderToken(),
      ),
    )
  })

  test('a stored token is kept when CardTrader is unavailable', () => {
    story(
      update,
      given(init()),
      message(Message.FailedCheckStoredToken({ reason: 'Unavailable' })),
      Command.expectNone(),
    )
  })

  test('submitting without a token asks for one', () => {
    story(
      update,
      given(withToken('   ')),
      message(Message.SubmittedConnect()),
      Command.expectNone(),
      model(next => {
        expect(next.maybeTokenProblem).toStrictEqual(Option.some('Missing'))
      }),
    )
  })

  test('submitting a malformed token sends nothing', () => {
    story(
      update,
      given(withToken('not a token')),
      message(Message.SubmittedConnect()),
      Command.expectNone(),
      model(next => {
        expect(next.maybeTokenProblem).toStrictEqual(Option.some('Malformed'))
      }),
    )
  })

  test('a valid token connects and clears the input', () => {
    story(
      update,
      given(withToken('test.token-0123456789abcdef')),
      message(Message.SubmittedConnect()),
      model(next => {
        expect(next.connection).toStrictEqual(Connection.Connecting())
      }),
      Command.expectExact(ConnectCardTrader),
      Command.resolve(
        ConnectCardTrader,
        Message.SucceededConnectCardTrader({
          appName: 'Deck app',
          isRemembered: false,
        }),
      ),
      model(next => {
        expect(next.connection).toStrictEqual(
          Connection.Connected({ appName: 'Deck app', isRemembered: false }),
        )
        expect(Redacted.value(next.tokenInput)).toBe('')
      }),
    )
  })

  test('disconnecting forgets the token', () => {
    story(
      update,
      given(
        modifyFields(init(), {
          connection: () =>
            Connection.Connected({ appName: 'Deck app', isRemembered: true }),
        }),
      ),
      message(Message.ClickedDisconnect()),
      model(next => {
        expect(next.connection).toStrictEqual(Connection.Disconnected())
      }),
      Command.expectExact(ForgetCardTraderToken),
      Command.resolve(
        ForgetCardTraderToken,
        Message.CompletedForgetCardTraderToken(),
      ),
    )
  })
})
