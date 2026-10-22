import { Schema } from 'effect'
import type { Update } from 'foldkit'
import type { Html, HtmlBuilder } from 'foldkit/html'
import { defineMessageUnion } from 'foldkit/message'

import * as Link from './link'

export const Model = Schema.Struct({})
export type Model = typeof Model.Type

export const Message = defineMessageUnion({})
export type Message = typeof Message.Type

export const initialModel: Model = {}

export const update = (model: Model): Update.Return<Model, Message> => ({
  model,
})

export const view = (_model: Model, h: HtmlBuilder<Message>): Html =>
  h.nav(
    [],
    [
      Link.view(
        { href: '/', content: ['Home'], variant: 'Nav', isCurrent: true },
        h,
      ),
      Link.view({ href: '/about', content: ['About'], variant: 'Nav' }, h),
    ],
  )
