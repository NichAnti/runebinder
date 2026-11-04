import type { Html, HtmlBuilder } from 'foldkit/html'

import { Button as HeadlessButton } from '@foldkit/ui'

import * as Icon from './icon'

export type Variant = 'Default' | 'Danger'

export type Action<Message> =
  | Readonly<{ _tag: 'Click'; message: Message }>
  | Readonly<{ _tag: 'External'; href: string }>

export type ViewConfig<Message> = Readonly<{
  icon: Icon.Name
  label: string
  action: Action<Message>
  variant?: Variant
  size?: Size
  isDisabled?: boolean
}>

export type Size = 'Medium' | 'Small'

const recipe = {
  base: 'inline-flex shrink-0 cursor-pointer items-center justify-center rounded-control border border-border bg-surface transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50',
  variants: {
    Default: 'text-fg hover:not-data-[disabled]:bg-surface-raised',
    Danger: 'text-danger hover:not-data-[disabled]:bg-surface-raised',
  } satisfies Record<Variant, string>,
  sizes: { Medium: 'size-9', Small: 'size-7' } satisfies Record<Size, string>,
  defaults: { variant: 'Default', size: 'Medium' } satisfies Readonly<{
    variant: Variant
    size: Size
  }>,
}

export const view = <Message>(
  {
    icon,
    label,
    action,
    variant = recipe.defaults.variant,
    size = recipe.defaults.size,
    isDisabled = false,
  }: ViewConfig<Message>,
  h: HtmlBuilder<Message>,
): Html => {
  const attributes = [
    h.AriaLabel(label),
    h.Title(label),
    h.DataAttribute('slot', 'icon-button'),
    h.Class(`${recipe.base} ${recipe.variants[variant]} ${recipe.sizes[size]}`),
  ]
  const content = [
    Icon.view({ name: icon, size: size === 'Small' ? 'Small' : 'Medium' }),
  ]

  return action._tag === 'External'
    ? h.a(
        [
          h.Href(action.href),
          h.Target('_blank'),
          h.Rel('noopener noreferrer'),
          ...attributes,
        ],
        content,
      )
    : HeadlessButton.view(
        {
          onClick: action.message,
          isDisabled,
          toView: button =>
            h.button([...button.button, ...attributes], content),
        },
        h,
      )
}
