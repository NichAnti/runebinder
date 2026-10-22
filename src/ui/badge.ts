import type { Html, HtmlBuilder } from 'foldkit/html'

import type { Printing } from '../domain'

export type Tone = 'Neutral' | 'Accent' | Printing.Domain

export type ViewConfig = Readonly<{
  content: ReadonlyArray<Html | string>
  tone?: Tone
}>

const recipe = {
  base: 'inline-flex items-center gap-1 rounded-control px-1.5 py-0.5 text-xs font-medium',
  variants: {
    Neutral: 'bg-surface-raised text-fg ring-1 ring-border',
    Accent: 'bg-accent text-accent-fg',
    Fury: 'bg-domain-fury text-white',
    Calm: 'bg-domain-calm text-white',
    Mind: 'bg-domain-mind text-white',
    Body: 'bg-domain-body text-white',
    Chaos: 'bg-domain-chaos text-white',
    Order: 'bg-domain-order text-black',
    Colorless: 'bg-domain-colorless text-black',
  } satisfies Record<Tone, string>,
  defaults: { tone: 'Neutral' } satisfies Readonly<{ tone: Tone }>,
}

export const view = <Message>(
  { content, tone = recipe.defaults.tone }: ViewConfig,
  h: HtmlBuilder<Message>,
): Html =>
  h.span(
    [
      h.DataAttribute('slot', 'badge'),
      h.Class(`${recipe.base} ${recipe.variants[tone]}`),
    ],
    content,
  )
