import type { Html, HtmlBuilder } from 'foldkit/html'

import { Button as HeadlessButton } from '@foldkit/ui'

export type Variant = 'Primary' | 'Secondary'

export type ViewConfig<Message> = Readonly<{
  content: ReadonlyArray<Html | string>
  variant?: Variant
  onClick?: Message
  type?: 'button' | 'submit'
  isDisabled?: boolean
}>

const recipe = {
  base: 'inline-flex cursor-pointer items-center justify-center gap-2 rounded-control px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50',
  variants: {
    Primary:
      'bg-accent text-accent-fg hover:not-data-[disabled]:bg-accent-hover',
    Secondary:
      'border border-border bg-surface text-fg hover:not-data-[disabled]:bg-surface-raised',
  } satisfies Record<Variant, string>,
  defaults: { variant: 'Primary' } satisfies Readonly<{ variant: Variant }>,
}

export const view = <Message>(
  config: ViewConfig<Message>,
  h: HtmlBuilder<Message>,
): Html => {
  const { content, variant = recipe.defaults.variant, ...behavior } = config

  return HeadlessButton.view(
    {
      ...behavior,
      toView: attributes =>
        h.button(
          [
            ...attributes.button,
            h.DataAttribute('slot', 'button'),
            h.Class(`${recipe.base} ${recipe.variants[variant]}`),
          ],
          content,
        ),
    },
    h,
  )
}
