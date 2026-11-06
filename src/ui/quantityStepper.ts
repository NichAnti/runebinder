import type { Html, HtmlBuilder } from 'foldkit/html'

import { Button as HeadlessButton } from '@foldkit/ui'

export type ViewConfig<Message> = Readonly<{
  label: string
  quantity: number
  max: number
  onDecrement: Message
  onIncrement: Message
  isDisabled?: boolean
  size?: Size
}>

export type Size = 'Medium' | 'Small'

const recipe = {
  root: 'inline-flex shrink-0 items-center rounded-control border border-border bg-surface',
  button: {
    base: 'inline-flex cursor-pointer items-center justify-center text-fg hover:not-data-[disabled]:bg-surface-raised focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50',
    variants: { Medium: 'size-8', Small: 'size-7' } satisfies Record<
      Size,
      string
    >,
  },
  value: {
    base: 'px-1 text-center font-semibold tabular-nums text-fg',
    variants: {
      Medium: 'min-w-8 text-sm',
      Small: 'min-w-6 text-xs',
    } satisfies Record<Size, string>,
  },
  defaults: { size: 'Medium' } satisfies Readonly<{ size: Size }>,
}

const stepView = <Message>(
  slot: 'decrement' | 'increment',
  accessibleName: string,
  symbol: string,
  onClick: Message,
  isDisabled: boolean,
  size: Size,
  h: HtmlBuilder<Message>,
): Html =>
  HeadlessButton.view(
    {
      onClick,
      isDisabled,
      toView: attributes =>
        h.button(
          [
            ...attributes.button,
            h.AriaLabel(accessibleName),
            h.DataAttribute('slot', slot),
            h.Class(`${recipe.button.base} ${recipe.button.variants[size]}`),
          ],
          [symbol],
        ),
    },
    h,
  )

export const view = <Message>(
  {
    label,
    quantity,
    max,
    onDecrement,
    onIncrement,
    isDisabled = false,
    size = recipe.defaults.size,
  }: ViewConfig<Message>,
  h: HtmlBuilder<Message>,
): Html =>
  h.div(
    [
      h.Role('group'),
      h.AriaLabel(label),
      h.DataAttribute('slot', 'quantity-stepper'),
      h.Class(recipe.root),
    ],
    [
      stepView(
        'decrement',
        'Remove one',
        '−',
        onDecrement,
        isDisabled || quantity <= 0,
        size,
        h,
      ),
      h.output(
        [
          h.AriaLive('polite'),
          h.DataAttribute('slot', 'value'),
          h.Class(`${recipe.value.base} ${recipe.value.variants[size]}`),
        ],
        [`${quantity}`],
      ),
      stepView(
        'increment',
        'Add one',
        '+',
        onIncrement,
        isDisabled || quantity >= max,
        size,
        h,
      ),
    ],
  )
