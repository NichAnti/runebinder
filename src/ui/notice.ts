import { Array } from 'effect'
import type { Html, HtmlBuilder } from 'foldkit/html'

export type Variant = 'Info' | 'Error'

export type ViewConfig = Readonly<{
  title: string
  description: ReadonlyArray<Html | string>
  actions?: ReadonlyArray<Html>
  variant?: Variant
}>

const recipe = {
  base: 'flex flex-col items-start gap-2 rounded-card border p-6',
  variants: {
    Info: 'border-border bg-surface',
    Error: 'border-danger bg-surface',
  } satisfies Record<Variant, string>,
  title: 'text-base font-semibold text-fg',
  description: 'text-sm text-fg-muted',
  actions: 'mt-2 flex gap-2',
  defaults: { variant: 'Info' } satisfies Readonly<{ variant: Variant }>,
}

export const view = <Message>(
  {
    title,
    description,
    actions = [],
    variant = recipe.defaults.variant,
  }: ViewConfig,
  h: HtmlBuilder<Message>,
): Html =>
  h.section(
    [
      ...(variant === 'Error' ? [h.Role('alert')] : [h.Role('status')]),
      h.DataAttribute('slot', 'notice'),
      h.Class(`${recipe.base} ${recipe.variants[variant]}`),
    ],
    [
      h.h2([h.DataAttribute('slot', 'title'), h.Class(recipe.title)], [title]),
      h.p(
        [h.DataAttribute('slot', 'description'), h.Class(recipe.description)],
        description,
      ),
      ...(Array.isReadonlyArrayNonEmpty(actions)
        ? [
            h.div(
              [h.DataAttribute('slot', 'actions'), h.Class(recipe.actions)],
              actions,
            ),
          ]
        : []),
    ],
  )
