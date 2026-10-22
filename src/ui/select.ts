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
}>

const recipe = {
  root: 'flex items-center gap-2',
  label: 'text-sm text-fg-muted',
  select:
    'cursor-pointer rounded-control border border-border bg-surface px-2 py-1 text-sm text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
}

export const view = <Message>(
  { id, label, value, options, onChange }: ViewConfig<Message>,
  h: HtmlBuilder<Message>,
): Html =>
  HeadlessSelect.view(
    {
      id,
      value,
      onChange,
      toView: attributes =>
        h.div(
          [h.DataAttribute('slot', 'select'), h.Class(recipe.root)],
          [
            h.label(
              [
                ...attributes.label,
                h.DataAttribute('slot', 'label'),
                h.Class(recipe.label),
              ],
              [label],
            ),
            h.select(
              [
                ...attributes.select,
                h.DataAttribute('slot', 'control'),
                h.Class(recipe.select),
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
