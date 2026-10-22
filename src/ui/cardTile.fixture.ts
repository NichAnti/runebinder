import { Option, Schema } from 'effect'
import type { Update } from 'foldkit'
import type { Html, HtmlBuilder } from 'foldkit/html'
import { defineMessageUnion } from 'foldkit/message'

import * as CardTile from './cardTile'
import * as Notice from './notice'

export const Model = Schema.Struct({})
export type Model = typeof Model.Type

export const Message = defineMessageUnion({})
export type Message = typeof Message.Type

export const initialModel: Model = {}

export const update = (model: Model): Update.Return<Model, Message> => ({
  model,
})

export const view = (_model: Model, h: HtmlBuilder<Message>): Html =>
  h.div(
    [],
    [
      CardTile.view(
        {
          href: '/cards/test-unit',
          imageUrl: 'https://example.com/test.png',
          imageAlt: 'Test Unit artwork',
          title: 'Test Unit',
          maybeSubtitle: Option.some('Tester'),
          domains: ['Fury', 'Calm'],
          meta: '2 printings',
        },
        h,
      ),
      Notice.view({ title: 'Loading', description: ['Please wait'] }, h),
      Notice.view(
        { title: 'Failed', description: ['Try again'], variant: 'Error' },
        h,
      ),
    ],
  )
