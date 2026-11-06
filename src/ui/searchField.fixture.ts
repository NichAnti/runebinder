import { Schema } from 'effect'
import type { Update } from 'foldkit'
import type { Html, HtmlBuilder } from 'foldkit/html'
import { defineMessageUnion } from 'foldkit/message'
import { modifyFields } from 'foldkit/struct'

import * as SearchField from './searchField'

export const Model = Schema.Struct({ value: Schema.String })
export type Model = typeof Model.Type

export const Message = defineMessageUnion({
  UpdatedSearch: { value: Schema.String },
})
export type Message = typeof Message.Type

export const initialModel: Model = { value: '' }

export const update = (model: Model, message: Message) =>
  Message.match<Update.Return<Model, Message>>(message, {
    UpdatedSearch: ({ value }) => ({
      model: modifyFields(model, { value: () => value }),
    }),
  })

export const view = (model: Model, h: HtmlBuilder<Message>): Html =>
  h.div(
    [],
    [
      SearchField.view(
        {
          id: 'search',
          label: 'Search cards',
          value: model.value,
          onInput: value => Message.UpdatedSearch({ value }),
        },
        h,
      ),
      h.p([], [`Searching for ${model.value}`]),
    ],
  )
