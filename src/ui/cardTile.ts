import { Array, Option } from 'effect'
import type { Html, HtmlBuilder } from 'foldkit/html'

import type { Printing } from '../domain'

export type ViewConfig = Readonly<{
  href: string
  imageUrl: string
  imageAlt: string
  title: string
  maybeSubtitle: Option.Option<string>
  domains: ReadonlyArray<Printing.Domain>
  meta: string
}>

const DOMAIN_DOT: Readonly<Record<Printing.Domain, string>> = {
  Fury: 'bg-domain-fury',
  Calm: 'bg-domain-calm',
  Mind: 'bg-domain-mind',
  Body: 'bg-domain-body',
  Chaos: 'bg-domain-chaos',
  Order: 'bg-domain-order',
  Colorless: 'bg-domain-colorless',
}

const recipe = {
  root: 'group flex flex-col gap-2 rounded-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
  image:
    'aspect-[744/1039] w-full rounded-card bg-surface-raised object-cover shadow-raised transition-transform group-hover:-translate-y-0.5',
  title: 'text-sm font-semibold text-fg',
  subtitle: 'text-xs text-fg-muted',
  footer: 'flex items-center justify-between gap-2',
  dots: 'flex gap-1',
  dot: 'size-2.5 rounded-full',
  meta: 'text-xs text-fg-muted',
}

export const view = <Message>(
  { href, imageUrl, imageAlt, title, maybeSubtitle, domains, meta }: ViewConfig,
  h: HtmlBuilder<Message>,
): Html =>
  h.a(
    [h.Href(href), h.DataAttribute('slot', 'card-tile'), h.Class(recipe.root)],
    [
      h.img([
        h.Src(imageUrl),
        h.Alt(imageAlt),
        h.Loading('lazy'),
        h.DataAttribute('slot', 'image'),
        h.Class(recipe.image),
      ]),
      h.div(
        [],
        [
          h.p(
            [h.DataAttribute('slot', 'title'), h.Class(recipe.title)],
            [title],
          ),
          Option.match(maybeSubtitle, {
            onNone: () => h.empty,
            onSome: subtitle =>
              h.p(
                [h.DataAttribute('slot', 'subtitle'), h.Class(recipe.subtitle)],
                [subtitle],
              ),
          }),
        ],
      ),
      h.div(
        [h.Class(recipe.footer)],
        [
          h.span(
            [h.DataAttribute('slot', 'domains'), h.Class(recipe.dots)],
            Array.map(domains, domain =>
              h.span([
                h.Title(domain),
                h.Class(`${recipe.dot} ${DOMAIN_DOT[domain]}`),
              ]),
            ),
          ),
          h.span(
            [h.DataAttribute('slot', 'meta'), h.Class(recipe.meta)],
            [meta],
          ),
        ],
      ),
    ],
  )
