import { Effect, Option, Redacted, Schema, String } from 'effect'
import { Command, Update } from 'foldkit'
import { modifyFields } from 'foldkit/struct'

import {
  CardTraderClient,
  CardTraderToken,
  TokenStore,
  parseToken,
} from '../../../service'
import { Dialog } from '../../../ui'
import { Message } from './message'
import { Connection, type Model, Submission } from './model'

type UpdateReturn = Update.Return<Model, Message, CardTraderClient | TokenStore>

// COMMAND

export const ReadStoredToken = Command.define('ReadStoredToken', {
  messages: [Message.FoundStoredToken, Message.FoundNoStoredToken],
  execute: Effect.gen(function* () {
    const store = yield* TokenStore
    return Option.match(yield* store.read, {
      onNone: () => Message.FoundNoStoredToken(),
      onSome: ({ isRemembered }) => Message.FoundStoredToken({ isRemembered }),
    })
  }),
})

export const CheckToken = Command.define('CheckToken', {
  messages: [
    Message.SucceededCheckToken,
    Message.FailedCheckToken,
    Message.FoundNoStoredToken,
  ],
  execute: Effect.gen(function* () {
    const store = yield* TokenStore
    const client = yield* CardTraderClient
    const maybeStored = yield* store.read

    if (Option.isNone(maybeStored)) {
      return Message.FoundNoStoredToken()
    } else {
      const info = yield* client.info(maybeStored.value.token)
      return Message.SucceededCheckToken({ appName: info.name })
    }
  }).pipe(
    Effect.catchTag('CardTraderError', ({ reason }) =>
      Effect.succeed(Message.FailedCheckToken({ reason })),
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

// DIALOG

const dialogFold = {
  read: (model: Model) => Option.some(model.dialog),
  write: (model: Model, nextDialog: Dialog.Model): Model =>
    modifyFields(model, { dialog: () => nextDialog }),
  toParentMessage: (message: Dialog.Message) =>
    Message.GotDialogMessage({ message }),
  foldOutMessage: Dialog.OutMessage.match<Update.Step<Model, Message>>({
    Opened: () => stepModel => ({ model: stepModel }),
    Closed: () => stepModel => ({ model: stepModel }),
  }),
}

const foldDialog = Update.foldChild({ update: Dialog.update, ...dialogFold })
const openDialog = Update.foldChildStep({ update: Dialog.open, ...dialogFold })
const closeDialog = Update.foldChildStep({
  update: Dialog.close,
  ...dialogFold,
})

// ENTRY

export const ensureChecked = (model: Model): UpdateReturn =>
  model.connection._tag === 'NotChecked'
    ? {
        model: modifyFields(model, { connection: () => Connection.Checking() }),
        commands: [ReadStoredToken()],
      }
    : { model }

export const verify = (model: Model): UpdateReturn =>
  model.connection._tag === 'Connected' &&
  Option.isNone(model.connection.maybeAppName)
    ? { model, commands: [CheckToken()] }
    : { model }

const forgotten = (model: Model, wasRejected: boolean): UpdateReturn => ({
  model: modifyFields(model, {
    connection: () => Connection.Disconnected({ wasRejected }),
  }),
  commands: [ForgetCardTraderToken()],
})

export const rejectToken = (model: Model): UpdateReturn =>
  model.connection._tag === 'Connected' ? forgotten(model, true) : { model }

const emptyToken = Redacted.make('')

export const open = (model: Model): UpdateReturn =>
  openDialog(
    modifyFields(model, {
      tokenInput: () => emptyToken,
      maybeTokenProblem: () => Option.none(),
      submission: () => Submission.Idle(),
    }),
  )

// UPDATE

export const update = (model: Model, message: Message) =>
  Message.match<UpdateReturn>(message, {
    FoundStoredToken: ({ isRemembered }) => ({
      model: modifyFields(model, {
        connection: () =>
          Connection.Connected({ isRemembered, maybeAppName: Option.none() }),
      }),
    }),

    FoundNoStoredToken: () => ({
      model: modifyFields(model, {
        connection: () => Connection.Disconnected({ wasRejected: false }),
      }),
    }),

    SucceededCheckToken: ({ appName }) => ({
      model: modifyFields(model, {
        connection: connection =>
          connection._tag === 'Connected'
            ? Connection.Connected({
                isRemembered: connection.isRemembered,
                maybeAppName: Option.some(appName),
              })
            : connection,
      }),
    }),

    FailedCheckToken: ({ reason }) =>
      reason === 'InvalidToken' ? rejectToken(model) : { model },

    ClickedConnect: () => open(model),

    ClickedDisconnect: () => forgotten(model, false),

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
      if (model.submission._tag === 'Connecting') {
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
            submission: () => Submission.Connecting(),
          }),
          commands: [
            ConnectCardTrader({ token, isRemembered: model.isRemembered }),
          ],
        }),
      })
    },

    SucceededConnectCardTrader: ({ appName, isRemembered }) =>
      closeDialog(
        modifyFields(model, {
          connection: () =>
            Connection.Connected({
              isRemembered,
              maybeAppName: Option.some(appName),
            }),
          tokenInput: () => emptyToken,
          submission: () => Submission.Idle(),
        }),
      ),

    FailedConnectCardTrader: ({ reason }) => ({
      model: modifyFields(model, {
        submission: () => Submission.Failed({ reason }),
      }),
    }),

    CompletedForgetCardTraderToken: () => ({ model }),

    GotDialogMessage: ({ message }) => foldDialog(model, message),
  })

// QUERY

export const isConnected = (model: Model): boolean =>
  model.connection._tag === 'Connected'
