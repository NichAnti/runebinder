import type { Html, HtmlBuilder } from 'foldkit/html'

export type ViewConfig = Readonly<{
  path: string
  backHref: string
  backLabel: string
}>

export const view = <Message>(
  { path, backHref, backLabel }: ViewConfig,
  h: HtmlBuilder<Message>,
): Html =>
  h.section(
    [h.Class('flex flex-col gap-2')],
    [
      h.h1([h.Class('text-2xl font-semibold')], ['Page not found']),
      h.p([h.Class('text-fg-muted')], [`Nothing lives at ${path}.`]),
      h.a(
        [h.Href(backHref), h.Class('text-fg underline hover:text-accent')],
        [backLabel],
      ),
    ],
  )
