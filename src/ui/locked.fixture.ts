import { Schema } from 'effect'
import type { Update } from 'foldkit'
import type { Html, HtmlBuilder } from 'foldkit/html'
import { defineMessageUnion } from 'foldkit/message'
import { modifyFields } from 'foldkit/struct'

import * as Button from './button'
import * as Locked from './locked'

export const Model = Schema.Struct({
  isLocked: Schema.Boolean,
  unlockCount: Schema.Number,
  sendCount: Schema.Number,
})
export type Model = typeof Model.Type

export const Message = defineMessageUnion({
  ClickedUnlock: {},
  ClickedSend: {},
})
export type Message = typeof Message.Type

export const initialModel: Model = {
  isLocked: true,
  unlockCount: 0,
  sendCount: 0,
}

export const update = (model: Model, message: Message) =>
  Message.match<Update.Return<Model, Message>>(message, {
    ClickedUnlock: () => ({
      model: modifyFields(model, {
        isLocked: () => false,
        unlockCount: count => count + 1,
      }),
    }),
    ClickedSend: () => ({
      model: modifyFields(model, { sendCount: count => count + 1 }),
    }),
  })

export const view = (model: Model, h: HtmlBuilder<Message>): Html =>
  h.div(
    [],
    [
      Locked.view(
        {
          isLocked: model.isLocked,
          unlockLabel: 'Connect CardTrader',
          onUnlock: Message.ClickedUnlock(),
          content: [
            Button.view(
              { content: ['Send'], onClick: Message.ClickedSend() },
              h,
            ),
          ],
        },
        h,
      ),
      h.p([], [`Unlocked ${model.unlockCount}, sent ${model.sendCount}`]),
    ],
  )
