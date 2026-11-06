import { Array, Option } from 'effect'
import type { Html, HtmlBuilder } from 'foldkit/html'

import type { Printing } from '../domain'

export type ViewConfig = Readonly<{
  imageUrl: string
  imageAlt: string
  title: string
  maybeSubtitle: Option.Option<string>
  domains: ReadonlyArray<Printing.Domain>
  meta: string
  highlights: ReadonlyArray<string>
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
  root: 'group flex flex-col gap-2',
  frame: 'relative',
  image:
    'aspect-[744/1039] w-full rounded-card bg-surface-raised object-contain shadow-raised transition-transform group-hover:-translate-y-0.5',
  text: 'flex min-w-0 flex-col',
  title: 'line-clamp-2 text-sm font-semibold text-fg',
  subtitle: 'truncate text-xs text-fg-muted',
  footer: 'flex items-center justify-between gap-2',
  dots: 'flex gap-1',
  dot: 'size-2.5 rounded-full',
  meta: 'truncate text-xs text-fg-muted',
  highlights: 'absolute top-2 right-2 flex flex-col items-end gap-1',
  highlight:
    'rounded-control bg-accent px-2 py-0.5 text-xs font-semibold text-accent-fg shadow-raised',
}

export const view = <Message>(
  {
    imageUrl,
    imageAlt,
    title,
    maybeSubtitle,
    domains,
    meta,
    highlights,
  }: ViewConfig,
  h: HtmlBuilder<Message>,
): Html =>
  h.span(
    [h.DataAttribute('slot', 'card-tile'), h.Class(recipe.root)],
    [
      h.span(
        [h.DataAttribute('slot', 'frame'), h.Class(recipe.frame)],
        [
          h.img([
            h.Src(imageUrl),
            h.Alt(imageAlt),
            h.Loading('lazy'),
            h.DataAttribute('slot', 'image'),
            h.Class(recipe.image),
          ]),
          Array.match(highlights, {
            onEmpty: () => h.empty,
            onNonEmpty: all =>
              h.span(
                [
                  h.DataAttribute('slot', 'highlights'),
                  h.Class(recipe.highlights),
                ],
                Array.map(all, highlight =>
                  h.span(
                    [
                      h.DataAttribute('slot', 'highlight'),
                      h.Class(recipe.highlight),
                    ],
                    [highlight],
                  ),
                ),
              ),
          }),
        ],
      ),
      h.span(
        [h.Class(recipe.text)],
        [
          h.span(
            [
              h.DataAttribute('slot', 'title'),
              h.Title(title),
              h.Class(recipe.title),
            ],
            [title],
          ),
          Option.match(maybeSubtitle, {
            onNone: () => h.empty,
            onSome: subtitle =>
              h.span(
                [h.DataAttribute('slot', 'subtitle'), h.Class(recipe.subtitle)],
                [subtitle],
              ),
          }),
        ],
      ),
      h.span(
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
