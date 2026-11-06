import { Array } from 'effect'
import type { Html, HtmlBuilder } from 'foldkit/html'

import { Select as HeadlessSelect } from '@foldkit/ui'

export type Option = Readonly<{ value: string; label: string }>

export type ViewConfig<Message> = Readonly<{
  id: string
  label: string
  value: string
  options: ReadonlyArray<Option>
  onChange: (value: string) => Message
  variant?: Variant
}>

export type Variant = 'Default' | 'Compact'

const recipe = {
  root: {
    Default: 'flex items-center gap-2',
    Compact: 'flex w-full min-w-0',
  } satisfies Record<Variant, string>,
  label: {
    Default: 'text-sm text-fg-muted',
    Compact: 'sr-only',
  } satisfies Record<Variant, string>,
  select: {
    base: 'cursor-pointer rounded-control border border-border bg-surface text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
    variants: {
      Default: 'px-2 py-1 text-sm',
      Compact: 'w-full min-w-0 truncate px-1.5 py-1 text-xs',
    } satisfies Record<Variant, string>,
  },
  defaults: { variant: 'Default' } satisfies Readonly<{ variant: Variant }>,
}

export const view = <Message>(
  {
    id,
    label,
    value,
    options,
    onChange,
    variant = recipe.defaults.variant,
  }: ViewConfig<Message>,
  h: HtmlBuilder<Message>,
): Html =>
  HeadlessSelect.view(
    {
      id,
      value,
      onChange,
      toView: attributes =>
        h.div(
          [h.DataAttribute('slot', 'select'), h.Class(recipe.root[variant])],
          [
            h.label(
              [
                ...attributes.label,
                h.DataAttribute('slot', 'label'),
                h.Class(recipe.label[variant]),
              ],
              [label],
            ),
            h.select(
              [
                ...attributes.select,
                h.DataAttribute('slot', 'control'),
                h.Class(
                  `${recipe.select.base} ${recipe.select.variants[variant]}`,
                ),
              ],
              Array.map(options, option =>
                h.option(
                  [h.Value(option.value), h.Selected(option.value === value)],
                  [option.label],
                ),
              ),
            ),
          ],
        ),
    },
    h,
  )
