import type { Html, HtmlBuilder } from 'foldkit/html'

import { Link } from '../ui'

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
      Link.view({ href: backHref, content: [backLabel] }, h),
    ],
  )
