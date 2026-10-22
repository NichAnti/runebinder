import type { Html, HtmlBuilder } from 'foldkit/html'

export const view = <Message>(h: HtmlBuilder<Message>): Html =>
  h.section(
    [h.Class('flex flex-col gap-2')],
    [
      h.h1([h.Class('text-2xl font-semibold')], ['Catalogue']),
      h.p(
        [h.Class('text-fg-muted')],
        ['The card catalogue is not available yet.'],
      ),
    ],
  )
