import type { Html, HtmlBuilder } from 'foldkit/html'

export type Variant = 'Inline' | 'Nav' | 'Media' | 'Primary' | 'Secondary'

export type ViewConfig = Readonly<{
  href: string
  content: ReadonlyArray<Html | string>
  variant?: Variant
  isCurrent?: boolean
  isExternal?: boolean
}>

const recipe = {
  base: 'rounded-control focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
  variants: {
    Inline: 'text-fg underline underline-offset-2 hover:text-accent',
    Nav: 'px-2 py-1 text-sm font-medium text-fg-muted hover:text-fg aria-[current=page]:font-semibold aria-[current=page]:text-fg',
    Media:
      'flex items-center gap-3 p-1 text-sm font-medium text-fg-muted hover:bg-surface-raised hover:text-fg aria-[current=page]:bg-surface-raised aria-[current=page]:font-semibold aria-[current=page]:text-fg',
    Primary:
      'inline-flex items-center justify-center gap-2 bg-accent px-4 py-2.5 text-sm font-semibold text-accent-fg hover:bg-accent-hover',
    Secondary:
      'inline-flex items-center justify-center gap-2 border border-border bg-surface px-4 py-2.5 text-sm font-semibold text-fg hover:bg-surface-raised',
  } satisfies Record<Variant, string>,
  defaults: { variant: 'Inline' } satisfies Readonly<{ variant: Variant }>,
}

export const view = <Message>(
  {
    href,
    content,
    variant = recipe.defaults.variant,
    isCurrent = false,
    isExternal = false,
  }: ViewConfig,
  h: HtmlBuilder<Message>,
): Html =>
  h.a(
    [
      h.Href(href),
      ...(isCurrent ? [h.AriaCurrent('page')] : []),
      ...(isExternal ? [h.Target('_blank'), h.Rel('noopener noreferrer')] : []),
      h.DataAttribute('slot', 'link'),
      h.Class(`${recipe.base} ${recipe.variants[variant]}`),
    ],
    content,
  )
