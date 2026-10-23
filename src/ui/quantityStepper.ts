import type { Html, HtmlBuilder } from 'foldkit/html'

import { Button as HeadlessButton } from '@foldkit/ui'

export type ViewConfig<Message> = Readonly<{
  label: string
  quantity: number
  max: number
  onDecrement: Message
  onIncrement: Message
  isDisabled?: boolean
}>

const recipe = {
  root: 'inline-flex items-center rounded-control border border-border bg-surface',
  button:
    'inline-flex size-8 cursor-pointer items-center justify-center text-fg hover:not-data-[disabled]:bg-surface-raised focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50',
  value: 'min-w-8 px-1 text-center text-sm font-semibold tabular-nums text-fg',
}

const stepView = <Message>(
  slot: 'decrement' | 'increment',
  accessibleName: string,
  symbol: string,
  onClick: Message,
  isDisabled: boolean,
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
            h.Class(recipe.button),
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
        h,
      ),
      h.output(
        [
          h.AriaLive('polite'),
          h.DataAttribute('slot', 'value'),
          h.Class(recipe.value),
        ],
        [`${quantity}`],
      ),
      stepView(
        'increment',
        'Add one',
        '+',
        onIncrement,
        isDisabled || quantity >= max,
        h,
      ),
    ],
  )
