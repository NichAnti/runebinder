import { Option, Schema } from 'effect'
import type { Update } from 'foldkit'
import type { Html, HtmlBuilder } from 'foldkit/html'
import { defineMessageUnion } from 'foldkit/message'
import { modifyFields } from 'foldkit/struct'

import * as RangeFilter from './rangeFilter'

export const Model = Schema.Struct({
  maybeMin: Schema.Option(Schema.Number),
  maybeMax: Schema.Option(Schema.Number),
})
export type Model = typeof Model.Type

export const Message = defineMessageUnion({
  ChangedMin: { value: Schema.Option(Schema.Number) },
  ChangedMax: { value: Schema.Option(Schema.Number) },
})
export type Message = typeof Message.Type

export const initialModel: Model = {
  maybeMin: Option.none(),
  maybeMax: Option.none(),
}

export const update = (model: Model, message: Message) =>
  Message.match<Update.Return<Model, Message>>(message, {
    ChangedMin: ({ value }) => ({
      model: modifyFields(model, { maybeMin: () => value }),
    }),
    ChangedMax: ({ value }) => ({
      model: modifyFields(model, { maybeMax: () => value }),
    }),
  })

const describeBound = (maybeValue: Option.Option<number>): string =>
  Option.match(maybeValue, { onNone: () => 'any', onSome: value => `${value}` })

export const view = (model: Model, h: HtmlBuilder<Message>): Html =>
  h.div(
    [],
    [
      RangeFilter.view(
        {
          id: 'energy',
          label: 'Energy',
          maybeMin: model.maybeMin,
          maybeMax: model.maybeMax,
          onChangeMin: value => Message.ChangedMin({ value }),
          onChangeMax: value => Message.ChangedMax({ value }),
        },
        h,
      ),
      h.p(
        [],
        [
          `From ${describeBound(model.maybeMin)} to ${describeBound(model.maybeMax)}`,
        ],
      ),
    ],
  )
