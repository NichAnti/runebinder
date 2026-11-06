import { Schema } from 'effect'
import type { Update } from 'foldkit'
import type { Html, HtmlBuilder } from 'foldkit/html'
import { defineMessageUnion } from 'foldkit/message'
import { modifyFields } from 'foldkit/struct'

import * as Button from './button'

export const Model = Schema.Struct({
  clickCount: Schema.Number,
  isDisabled: Schema.Boolean,
})
export type Model = typeof Model.Type

export const Message = defineMessageUnion({
  ClickedSave: {},
})
export type Message = typeof Message.Type

export const initialModel: Model = { clickCount: 0, isDisabled: false }

export const update = (model: Model, message: Message) =>
  Message.match<Update.Return<Model, Message>>(message, {
    ClickedSave: () => ({
      model: modifyFields(model, { clickCount: count => count + 1 }),
    }),
  })

export const view = (model: Model, h: HtmlBuilder<Message>): Html =>
  h.div(
    [],
    [
      Button.view(
        {
          content: ['Save'],
          onClick: Message.ClickedSave(),
          isDisabled: model.isDisabled,
        },
        h,
      ),
      Button.view(
        { content: ['Submit'], variant: 'Secondary', type: 'submit' },
        h,
      ),
      h.p([], [`Clicked ${model.clickCount}`]),
    ],
  )
