import { Schema } from 'effect'
import type { Update } from 'foldkit'
import type { Html, HtmlBuilder } from 'foldkit/html'
import { defineMessageUnion } from 'foldkit/message'
import { modifyFields } from 'foldkit/struct'

import * as Checkbox from './checkbox'

export const Model = Schema.Struct({ isRemembered: Schema.Boolean })
export type Model = typeof Model.Type

export const Message = defineMessageUnion({
  ToggledRemember: { isChecked: Schema.Boolean },
})
export type Message = typeof Message.Type

export const initialModel: Model = { isRemembered: false }

export const update = (model: Model, message: Message) =>
  Message.match<Update.Return<Model, Message>>(message, {
    ToggledRemember: ({ isChecked }) => ({
      model: modifyFields(model, { isRemembered: () => isChecked }),
    }),
  })

export const view = (model: Model, h: HtmlBuilder<Message>): Html =>
  Checkbox.view(
    {
      id: 'remember',
      label: 'Remember on this device',
      description: 'Otherwise it is forgotten when this tab closes.',
      isChecked: model.isRemembered,
      onToggle: isChecked => Message.ToggledRemember({ isChecked }),
    },
    h,
  )
