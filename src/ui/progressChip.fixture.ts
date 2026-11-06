import { Schema } from 'effect'
import type { Update } from 'foldkit'
import type { Html, HtmlBuilder } from 'foldkit/html'
import { defineMessageUnion } from 'foldkit/message'
import { modifyFields } from 'foldkit/struct'

import * as ProgressChip from './progressChip'

export const Model = Schema.Struct({ jumpedTo: Schema.String })
export type Model = typeof Model.Type

export const Message = defineMessageUnion({
  ClickedChip: { part: Schema.String },
})
export type Message = typeof Message.Type

export const initialModel: Model = { jumpedTo: 'nothing' }

export const update = (model: Model, message: Message) =>
  Message.match<Update.Return<Model, Message>>(message, {
    ClickedChip: ({ part }) => ({
      model: modifyFields(model, { jumpedTo: () => part }),
    }),
  })

export const view = (model: Model, h: HtmlBuilder<Message>): Html =>
  h.div(
    [],
    [
      ProgressChip.view(
        {
          label: 'Main',
          value: '32/40',
          status: 'Unfinished',
          onClick: Message.ClickedChip({ part: 'Main' }),
        },
        h,
      ),
      ProgressChip.view(
        {
          label: 'Runes',
          value: '12/12',
          status: 'Done',
          onClick: Message.ClickedChip({ part: 'Runes' }),
        },
        h,
      ),
      ProgressChip.view(
        {
          label: 'Battlefields',
          value: '4/3',
          status: 'Problem',
          onClick: Message.ClickedChip({ part: 'Battlefields' }),
        },
        h,
      ),
      h.p([], [`Jumped to ${model.jumpedTo}`]),
    ],
  )
