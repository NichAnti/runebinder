import type { Html, HtmlBuilder } from 'foldkit/html'

export const view = <Message>(h: HtmlBuilder<Message>): Html =>
  h.section(
    [h.Class('flex flex-col gap-2')],
    [
      h.h1([h.Class('text-2xl font-semibold')], ['Sign in']),
      h.p([h.Class('text-fg-muted')], ['Sign-in is not available yet.']),
    ],
  )
