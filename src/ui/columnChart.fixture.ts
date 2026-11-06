import { Schema } from 'effect'
import type { Update } from 'foldkit'
import type { Html, HtmlBuilder } from 'foldkit/html'
import { defineMessageUnion } from 'foldkit/message'

import * as ColumnChart from './columnChart'

export const Model = Schema.Struct({})
export type Model = typeof Model.Type

export const Message = defineMessageUnion({})
export type Message = typeof Message.Type

export const initialModel: Model = {}

export const update = (model: Model): Update.Return<Model, Message> => ({
  model,
})

export const view = (_model: Model, h: HtmlBuilder<Message>): Html =>
  ColumnChart.view(
    {
      title: 'Energy curve',
      columns: [
        { label: '1', value: 4, description: '1 energy: 4 cards' },
        { label: '2', value: 0, description: '2 energy: no cards' },
        { label: '3', value: 8, description: '3 energy: 8 cards' },
      ],
    },
    h,
  )
