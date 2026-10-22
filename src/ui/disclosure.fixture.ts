import { Schema } from 'effect'
import type { Update } from 'foldkit'
import type { Html, HtmlBuilder } from 'foldkit/html'
import { defineMessageUnion } from 'foldkit/message'
import { modifyFields } from 'foldkit/struct'

import * as Disclosure from './disclosure'

export const Model = Schema.Struct({ isOpen: Schema.Boolean })
export type Model = typeof Model.Type

export const Message = defineMessageUnion({
  ToggledFilters: { isOpen: Schema.Boolean },
})
export type Message = typeof Message.Type

export const initialModel: Model = { isOpen: false }

export const update = (model: Model, message: Message) =>
  Message.match<Update.Return<Model, Message>>(message, {
    ToggledFilters: ({ isOpen }) => ({
      model: modifyFields(model, { isOpen: () => isOpen }),
    }),
  })

export const view = (model: Model, h: HtmlBuilder<Message>): Html =>
  Disclosure.view(
    {
      id: 'filters',
      summary: ['Filters'],
      content: [h.p([], ['Filter controls'])],
      isOpen: model.isOpen,
      onToggle: isOpen => Message.ToggledFilters({ isOpen }),
    },
    h,
  )
