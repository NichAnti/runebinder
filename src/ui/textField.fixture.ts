import { Schema } from 'effect'
import type { Update } from 'foldkit'
import {
  Field,
  NotValidated,
  Rule,
  makeRules,
  validate,
} from 'foldkit/fieldValidation'
import type { Html, HtmlBuilder } from 'foldkit/html'
import { defineMessageUnion } from 'foldkit/message'
import { modifyFields } from 'foldkit/struct'

import * as TextField from './textField'

export const Model = Schema.Struct({ email: Field(Schema.String) })
export type Model = typeof Model.Type

export const Message = defineMessageUnion({
  UpdatedEmail: { value: Schema.String },
})
export type Message = typeof Message.Type

const validateEmail = validate(
  makeRules({
    required: 'Email is required',
    rules: [Rule.email('Enter a valid email')],
  }),
)

export const initialModel: Model = { email: NotValidated({ value: '' }) }

export const update = (model: Model, message: Message) =>
  Message.match<Update.Return<Model, Message>>(message, {
    UpdatedEmail: ({ value }) => ({
      model: modifyFields(model, { email: () => validateEmail(value) }),
    }),
  })

export const view = (model: Model, h: HtmlBuilder<Message>): Html =>
  TextField.view(
    {
      id: 'email',
      label: 'Email',
      type: 'email',
      field: model.email,
      onInput: value => Message.UpdatedEmail({ value }),
    },
    h,
  )
