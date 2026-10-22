import type { Html, HtmlBuilder } from 'foldkit/html'

export type Variant = 'Inline' | 'Nav'

export type ViewConfig = Readonly<{
  href: string
  content: ReadonlyArray<Html | string>
  variant?: Variant
  isCurrent?: boolean
}>

const recipe = {
  base: 'rounded-control focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
  variants: {
    Inline: 'text-fg underline underline-offset-2 hover:text-accent',
    Nav: 'px-2 py-1 text-sm font-medium text-fg-muted hover:text-fg aria-[current=page]:font-semibold aria-[current=page]:text-fg',
  } satisfies Record<Variant, string>,
  defaults: { variant: 'Inline' } satisfies Readonly<{ variant: Variant }>,
}

export const view = <Message>(
  {
    href,
    content,
    variant = recipe.defaults.variant,
    isCurrent = false,
  }: ViewConfig,
  h: HtmlBuilder<Message>,
): Html =>
  h.a(
    [
      h.Href(href),
      ...(isCurrent ? [h.AriaCurrent('page')] : []),
      h.DataAttribute('slot', 'link'),
      h.Class(`${recipe.base} ${recipe.variants[variant]}`),
    ],
    content,
  )
