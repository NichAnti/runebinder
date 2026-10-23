import { Option, Redacted } from 'effect'
import { Command, given, message, model, story } from 'foldkit/story'
import { modifyFields } from 'foldkit/struct'
import { describe, expect, test } from 'vitest'

import { Message } from './message'
import { Connection, Submission, init } from './model'
import {
  CheckToken,
  ConnectCardTrader,
  ForgetCardTraderToken,
  ReadStoredToken,
  ensureChecked,
  rejectToken,
  update,
  verify,
} from './update'

const disconnected = modifyFields(init(), {
  connection: () => Connection.Disconnected({ wasRejected: false }),
})
const stored = modifyFields(init(), {
  connection: () =>
    Connection.Connected({ isRemembered: true, maybeAppName: Option.none() }),
})

const withToken = (raw: string) =>
  modifyFields(disconnected, { tokenInput: () => Redacted.make(raw) })

describe('CardTrader connection', () => {
  test('the stored token is read once, from the browser only', () => {
    const checking = ensureChecked(init())

    expect(checking.commands?.map(({ name }) => name)).toStrictEqual([
      ReadStoredToken.name,
    ])
    expect(ensureChecked(checking.model).commands).toBeUndefined()
    story(
      update,
      given(checking.model),
      message(Message.FoundStoredToken({ isRemembered: true })),
      model(next => {
        expect(next.connection).toStrictEqual(stored.connection)
      }),
    )
  })

  test('the settings page checks a stored token with CardTrader', () => {
    expect(verify(stored).commands?.map(({ name }) => name)).toStrictEqual([
      CheckToken.name,
    ])
    story(
      update,
      given(stored),
      message(Message.SucceededCheckToken({ appName: 'Deck app' })),
      model(next => {
        expect(next.connection).toStrictEqual(
          Connection.Connected({
            isRemembered: true,
            maybeAppName: Option.some('Deck app'),
          }),
        )
      }),
    )
  })

  test('a token CardTrader rejects is forgotten', () => {
    story(
      update,
      given(stored),
      message(Message.FailedCheckToken({ reason: 'InvalidToken' })),
      model(next => {
        expect(next.connection).toStrictEqual(
          Connection.Disconnected({ wasRejected: true }),
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
      given(stored),
      message(Message.FailedCheckToken({ reason: 'Unavailable' })),
      Command.expectNone(),
    )
  })

  test('rejecting only applies to a connected token', () => {
    expect(rejectToken(disconnected).commands).toBeUndefined()
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
        expect(next.submission).toStrictEqual(Submission.Connecting())
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
          Connection.Connected({
            isRemembered: false,
            maybeAppName: Option.some('Deck app'),
          }),
        )
        expect(Redacted.value(next.tokenInput)).toBe('')
      }),
    )
  })

  test('a rejected token keeps the dialog open with the reason', () => {
    story(
      update,
      given(withToken('test.token-0123456789abcdef')),
      message(Message.SubmittedConnect()),
      Command.resolve(
        ConnectCardTrader,
        Message.FailedConnectCardTrader({ reason: 'InvalidToken' }),
      ),
      model(next => {
        expect(next.submission).toStrictEqual(
          Submission.Failed({ reason: 'InvalidToken' }),
        )
        expect(next.connection).toStrictEqual(disconnected.connection)
      }),
    )
  })

  test('disconnecting forgets the token', () => {
    story(
      update,
      given(stored),
      message(Message.ClickedDisconnect()),
      model(next => {
        expect(next.connection).toStrictEqual(
          Connection.Disconnected({ wasRejected: false }),
        )
      }),
      Command.expectExact(ForgetCardTraderToken),
      Command.resolve(
        ForgetCardTraderToken,
        Message.CompletedForgetCardTraderToken(),
      ),
    )
  })
})
