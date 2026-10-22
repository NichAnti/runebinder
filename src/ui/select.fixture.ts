import { Schema } from 'effect'
import type { Update } from 'foldkit'
import type { Html, HtmlBuilder } from 'foldkit/html'
import { defineMessageUnion } from 'foldkit/message'
import { modifyFields } from 'foldkit/struct'

import * as Select from './select'

export const Model = Schema.Struct({ value: Schema.String })
export type Model = typeof Model.Type

export const Message = defineMessageUnion({
  ChangedSort: { value: Schema.String },
})
export type Message = typeof Message.Type

export const initialModel: Model = { value: 'name' }

export const update = (model: Model, message: Message) =>
  Message.match<Update.Return<Model, Message>>(message, {
    ChangedSort: ({ value }) => ({
      model: modifyFields(model, { value: () => value }),
    }),
  })

export const view = (model: Model, h: HtmlBuilder<Message>): Html =>
  h.div(
    [],
    [
      Select.view(
        {
          id: 'sort',
          label: 'Sort by',
          value: model.value,
          options: [
            { value: 'name', label: 'Name' },
            { value: 'energy', label: 'Energy' },
          ],
          onChange: value => Message.ChangedSort({ value }),
        },
        h,
      ),
      h.p([], [`Sorted by ${model.value}`]),
    ],
  )
