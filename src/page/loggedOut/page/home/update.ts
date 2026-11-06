import { Array, Effect, Record } from 'effect'
import { Command, type Update } from 'foldkit'
import { modifyFields } from 'foldkit/struct'

import { loadPrintings } from '../../../../service'
import { Message } from './message'
import { type Model, Showcase } from './model'
import { SHOWCASE_IDS } from './showcase'

// COMMAND

export const LoadShowcase = Command.define('LoadShowcase', {
  messages: [Message.SucceededLoadShowcase, Message.FailedLoadShowcase],
  execute: loadPrintings.pipe(
    Effect.map(printings =>
      Message.SucceededLoadShowcase({
        printings: Array.filter(printings, ({ id }) =>
          Array.contains(SHOWCASE_IDS, id),
        ),
      }),
    ),
    Effect.catch(() => Effect.succeed(Message.FailedLoadShowcase())),
  ),
})

// ENTER

export const enter = (model: Model): Update.Return<Model, Message> =>
  model.showcase._tag === 'NotAsked'
    ? {
        model: modifyFields(model, { showcase: () => Showcase.Loading() }),
        commands: [LoadShowcase()],
      }
    : { model }

// UPDATE

export const update = (
  model: Model,
  message: Message,
): Update.Return<Model, Message> =>
  Message.match(message, {
    SucceededLoadShowcase: ({ printings }) => ({
      model: modifyFields(model, {
        showcase: () =>
          Showcase.Ready({
            printings: Record.fromIterableBy(printings, ({ id }) => id),
          }),
      }),
    }),
    FailedLoadShowcase: () => ({
      model: modifyFields(model, { showcase: () => Showcase.Failed() }),
    }),
  })
