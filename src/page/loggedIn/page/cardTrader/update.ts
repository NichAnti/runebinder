import { Effect, Option, Redacted, Schema, String } from 'effect'
import { Command, type Update } from 'foldkit'
import { modifyFields } from 'foldkit/struct'

import {
  CardTraderClient,
  CardTraderToken,
  TokenStore,
  parseToken,
} from '../../../../service'
import { Message } from './message'
import { Connection, type Model } from './model'

type UpdateReturn = Update.Return<Model, Message, CardTraderClient | TokenStore>

// COMMAND

export const CheckStoredToken = Command.define('CheckStoredToken', {
  messages: [
    Message.FoundNoStoredToken,
    Message.SucceededCheckStoredToken,
    Message.FailedCheckStoredToken,
  ],
  execute: Effect.gen(function* () {
    const store = yield* TokenStore
    const client = yield* CardTraderClient
    const maybeStored = yield* store.read

    if (Option.isNone(maybeStored)) {
      return Message.FoundNoStoredToken()
    } else {
      const { token, isRemembered } = maybeStored.value
      const info = yield* client.info(token)
      return Message.SucceededCheckStoredToken({
        appName: info.name,
        isRemembered,
      })
    }
  }).pipe(
    Effect.catchTag('CardTraderError', ({ reason }) =>
      Effect.succeed(Message.FailedCheckStoredToken({ reason })),
    ),
  ),
})

export const ConnectCardTrader = Command.define('ConnectCardTrader', {
  args: {
    token: Schema.Redacted(CardTraderToken),
    isRemembered: Schema.Boolean,
  },
  messages: [
    Message.SucceededConnectCardTrader,
    Message.FailedConnectCardTrader,
  ],
  execute: ({ token, isRemembered }) =>
    Effect.gen(function* () {
      const client = yield* CardTraderClient
      const store = yield* TokenStore
      const info = yield* client.info(token)
      yield* store.save(token, isRemembered)
      return Message.SucceededConnectCardTrader({
        appName: info.name,
        isRemembered,
      })
    }).pipe(
      Effect.catchTag('CardTraderError', ({ reason }) =>
        Effect.succeed(Message.FailedConnectCardTrader({ reason })),
      ),
    ),
})

export const ForgetCardTraderToken = Command.define('ForgetCardTraderToken', {
  messages: [Message.CompletedForgetCardTraderToken],
  execute: Effect.gen(function* () {
    const store = yield* TokenStore
    yield* store.clear
    return Message.CompletedForgetCardTraderToken()
  }),
})

// ROUTE

export const enter = (model: Model): UpdateReturn => ({
  model: modifyFields(model, { connection: () => Connection.Checking() }),
  commands: [CheckStoredToken()],
})

// UPDATE

const emptyToken = Redacted.make('')

export const update = (model: Model, message: Message) =>
  Message.match<UpdateReturn>(message, {
    UpdatedToken: ({ value }) => ({
      model: modifyFields(model, {
        tokenInput: () => value,
        maybeTokenProblem: () => Option.none(),
      }),
    }),

    ToggledRemember: ({ isChecked }) => ({
      model: modifyFields(model, { isRemembered: () => isChecked }),
    }),

    SubmittedConnect: () => {
      if (model.connection._tag === 'Connecting') {
        return { model }
      }

      const raw = Redacted.value(model.tokenInput)

      return Option.match(parseToken(raw), {
        onNone: () => ({
          model: modifyFields(model, {
            maybeTokenProblem: () =>
              Option.some(
                String.isEmpty(String.trim(raw)) ? 'Missing' : 'Malformed',
              ),
          }),
        }),
        onSome: token => ({
          model: modifyFields(model, {
            connection: () => Connection.Connecting(),
          }),
          commands: [
            ConnectCardTrader({ token, isRemembered: model.isRemembered }),
          ],
        }),
      })
    },

    ClickedDisconnect: () => ({
      model: modifyFields(model, {
        connection: () => Connection.Disconnected(),
      }),
      commands: [ForgetCardTraderToken()],
    }),

    FoundNoStoredToken: () => ({
      model: modifyFields(model, {
        connection: () => Connection.Disconnected(),
      }),
    }),

    SucceededCheckStoredToken: ({ appName, isRemembered }) => ({
      model: modifyFields(model, {
        connection: () => Connection.Connected({ appName, isRemembered }),
      }),
    }),

    FailedCheckStoredToken: ({ reason }) =>
      reason === 'InvalidToken'
        ? {
            model: modifyFields(model, {
              connection: () => Connection.Failed({ reason }),
            }),
            commands: [ForgetCardTraderToken()],
          }
        : {
            model: modifyFields(model, {
              connection: () => Connection.Failed({ reason }),
            }),
          },

    SucceededConnectCardTrader: ({ appName, isRemembered }) => ({
      model: modifyFields(model, {
        connection: () => Connection.Connected({ appName, isRemembered }),
        tokenInput: () => emptyToken,
      }),
    }),

    FailedConnectCardTrader: ({ reason }) => ({
      model: modifyFields(model, {
        connection: () => Connection.Failed({ reason }),
      }),
    }),

    CompletedForgetCardTraderToken: () => ({ model }),
  })
