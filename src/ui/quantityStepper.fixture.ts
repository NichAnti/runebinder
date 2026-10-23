import { Schema } from 'effect'
import type { Update } from 'foldkit'
import type { Html, HtmlBuilder } from 'foldkit/html'
import { defineMessageUnion } from 'foldkit/message'
import { modifyFields } from 'foldkit/struct'

import * as QuantityStepper from './quantityStepper'

export const MAX = 3

export const Model = Schema.Struct({ quantity: Schema.Int })
export type Model = typeof Model.Type

export const Message = defineMessageUnion({
  ClickedDecrement: {},
  ClickedIncrement: {},
})
export type Message = typeof Message.Type

export const initialModel: Model = { quantity: 0 }

export const update = (model: Model, message: Message) =>
  Message.match<Update.Return<Model, Message>>(message, {
    ClickedDecrement: () => ({
      model: modifyFields(model, { quantity: quantity => quantity - 1 }),
    }),
    ClickedIncrement: () => ({
      model: modifyFields(model, { quantity: quantity => quantity + 1 }),
    }),
  })

export const view = (model: Model, h: HtmlBuilder<Message>): Html =>
  QuantityStepper.view(
    {
      label: 'Owned: Vi, Standard',
      quantity: model.quantity,
      max: MAX,
      onDecrement: Message.ClickedDecrement(),
      onIncrement: Message.ClickedIncrement(),
    },
    h,
  )
