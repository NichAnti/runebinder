import { Schema } from 'effect'
import type { Update } from 'foldkit'
import type { Html, HtmlBuilder } from 'foldkit/html'
import { defineMessageUnion } from 'foldkit/message'
import { modifyFields } from 'foldkit/struct'

import * as IconButton from './iconButton'

export const Model = Schema.Struct({
  syncCount: Schema.Number,
  isDisabled: Schema.Boolean,
})
export type Model = typeof Model.Type

export const Message = defineMessageUnion({
  ClickedSync: {},
})
export type Message = typeof Message.Type

export const initialModel: Model = { syncCount: 0, isDisabled: false }

export const update = (model: Model, message: Message) =>
  Message.match<Update.Return<Model, Message>>(message, {
    ClickedSync: () => ({
      model: modifyFields(model, { syncCount: count => count + 1 }),
    }),
  })

export const view = (model: Model, h: HtmlBuilder<Message>): Html =>
  h.div(
    [],
    [
      IconButton.view(
        {
          icon: 'ArrowPath',
          label: 'Sync on CardTrader',
          action: { _tag: 'Click', message: Message.ClickedSync() },
          isDisabled: model.isDisabled,
        },
        h,
      ),
      IconButton.view(
        {
          icon: 'ArrowTopRightOnSquare',
          label: 'Open on CardTrader',
          action: { _tag: 'External', href: 'https://www.cardtrader.com' },
        },
        h,
      ),
      h.p([], [`Synced ${model.syncCount}`]),
    ],
  )
