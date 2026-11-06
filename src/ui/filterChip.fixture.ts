import { Schema } from 'effect'
import type { Update } from 'foldkit'
import type { Html, HtmlBuilder } from 'foldkit/html'
import { defineMessageUnion } from 'foldkit/message'
import { modifyFields } from 'foldkit/struct'

import * as FilterChip from './filterChip'

export const Model = Schema.Struct({ isSelected: Schema.Boolean })
export type Model = typeof Model.Type

export const Message = defineMessageUnion({ ClickedFury: {} })
export type Message = typeof Message.Type

export const initialModel: Model = { isSelected: false }

export const update = (model: Model, message: Message) =>
  Message.match<Update.Return<Model, Message>>(message, {
    ClickedFury: () => ({
      model: modifyFields(model, { isSelected: isSelected => !isSelected }),
    }),
  })

export const view = (model: Model, h: HtmlBuilder<Message>): Html =>
  h.div(
    [],
    [
      FilterChip.view(
        {
          content: ['Fury'],
          count: 12,
          isSelected: model.isSelected,
          onToggle: Message.ClickedFury(),
        },
        h,
      ),
      FilterChip.view(
        {
          content: ['Empty'],
          count: 0,
          isSelected: false,
          onToggle: Message.ClickedFury(),
        },
        h,
      ),
    ],
  )
