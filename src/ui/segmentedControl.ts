import { Array } from 'effect'
import type { Html, HtmlBuilder } from 'foldkit/html'

import { Button as HeadlessButton } from '@foldkit/ui'

export type Choice<Value extends string> = Readonly<{
  value: Value
  label: string
}>

export type ViewConfig<Value extends string, Message> = Readonly<{
  label: string
  choices: ReadonlyArray<Choice<Value>>
  selected: Value
  onSelect: (value: Value) => Message
}>

const recipe = {
  root: 'inline-flex flex-wrap gap-1 rounded-control border border-border bg-surface p-1',
  choice:
    'cursor-pointer rounded-control px-2.5 py-1 text-sm text-fg-muted transition-colors hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus aria-pressed:bg-accent aria-pressed:font-semibold aria-pressed:text-accent-fg',
}

export const view = <Value extends string, Message>(
  { label, choices, selected, onSelect }: ViewConfig<Value, Message>,
  h: HtmlBuilder<Message>,
): Html =>
  h.div(
    [
      h.Role('group'),
      h.AriaLabel(label),
      h.DataAttribute('slot', 'segmented-control'),
      h.Class(recipe.root),
    ],
    Array.map(choices, ({ value, label: choiceLabel }) =>
      HeadlessButton.view(
        {
          onClick: onSelect(value),
          toView: attributes =>
            h.button(
              [
                ...attributes.button,
                h.AriaPressed(value === selected ? 'true' : 'false'),
                h.DataAttribute('slot', 'choice'),
                h.Class(recipe.choice),
              ],
              [choiceLabel],
            ),
        },
        h,
      ),
    ),
  )
