import type { Html, HtmlBuilder } from 'foldkit/html'

import { Checkbox as HeadlessCheckbox } from '@foldkit/ui'

export type ViewConfig<Message> = Readonly<{
  id: string
  label: string
  isChecked: boolean
  onToggle: (isChecked: boolean) => Message
  description?: string
  isDisabled?: boolean
  isLabelHidden?: boolean
}>

const recipe = {
  root: 'flex flex-col gap-1',
  row: 'flex items-center gap-2',
  box: 'flex size-5 cursor-pointer items-center justify-center rounded-control border border-border bg-surface text-accent-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus aria-checked:border-accent aria-checked:bg-accent aria-disabled:cursor-not-allowed aria-disabled:opacity-50',
  label: {
    Visible: 'cursor-pointer text-sm text-fg',
    Hidden: 'sr-only',
  },
  description: 'pl-7 text-sm text-fg-muted',
}

export const view = <Message>(
  {
    id,
    label,
    isChecked,
    onToggle,
    description,
    isDisabled = false,
    isLabelHidden = false,
  }: ViewConfig<Message>,
  h: HtmlBuilder<Message>,
): Html =>
  HeadlessCheckbox.view(
    {
      id,
      isChecked,
      onToggle,
      isDisabled,
      hasDescription: description !== undefined,
      toView: attributes =>
        h.div(
          [h.DataAttribute('slot', 'checkbox'), h.Class(recipe.root)],
          [
            h.div(
              [h.Class(recipe.row)],
              [
                h.button(
                  [
                    ...attributes.checkbox,
                    h.DataAttribute('slot', 'box'),
                    h.Class(recipe.box),
                  ],
                  isChecked ? ['✓'] : [],
                ),
                h.label(
                  [
                    ...attributes.label,
                    h.DataAttribute('slot', 'label'),
                    h.Class(recipe.label[isLabelHidden ? 'Hidden' : 'Visible']),
                  ],
                  [label],
                ),
              ],
            ),
            description === undefined
              ? h.empty
              : h.p(
                  [
                    ...attributes.description,
                    h.DataAttribute('slot', 'description'),
                    h.Class(recipe.description),
                  ],
                  [description],
                ),
          ],
        ),
    },
    h,
  )
