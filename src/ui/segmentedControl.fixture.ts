import { Schema } from 'effect'
import type { Update } from 'foldkit'
import type { Html, HtmlBuilder } from 'foldkit/html'
import { defineMessageUnion } from 'foldkit/message'
import { modifyFields } from 'foldkit/struct'

import * as SegmentedControl from './segmentedControl'

const Layout = Schema.Literals(['Grid', 'List'])

export const Model = Schema.Struct({ layout: Layout })
export type Model = typeof Model.Type

export const Message = defineMessageUnion({
  SelectedLayout: { layout: Layout },
})
export type Message = typeof Message.Type

export const initialModel: Model = { layout: 'Grid' }

export const update = (model: Model, message: Message) =>
  Message.match<Update.Return<Model, Message>>(message, {
    SelectedLayout: ({ layout }) => ({
      model: modifyFields(model, { layout: () => layout }),
    }),
  })

export const view = (model: Model, h: HtmlBuilder<Message>): Html =>
  SegmentedControl.view(
    {
      label: 'Show cards as',
      choices: [
        { value: 'Grid', label: 'Grid' },
        { value: 'List', label: 'List' },
      ],
      selected: model.layout,
      onSelect: layout => Message.SelectedLayout({ layout }),
    },
    h,
  )
