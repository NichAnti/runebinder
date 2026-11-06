import type { Html, HtmlBuilder } from 'foldkit/html'

import { Input } from '@foldkit/ui'

export type ViewConfig<Message> = Readonly<{
  id: string
  label: string
  value: string
  onInput: (value: string) => Message
  placeholder?: string
}>

const recipe = {
  root: 'flex flex-col gap-1',
  label: 'sr-only',
  input:
    'w-full rounded-control border border-border bg-surface px-3 py-2 text-fg placeholder:text-fg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
}

export const view = <Message>(
  { id, label, value, onInput, placeholder }: ViewConfig<Message>,
  h: HtmlBuilder<Message>,
): Html =>
  Input.view(
    {
      id,
      type: 'search',
      value,
      onInput,
      ...(placeholder === undefined ? {} : { placeholder }),
      toView: attributes =>
        h.div(
          [h.DataAttribute('slot', 'search-field'), h.Class(recipe.root)],
          [
            h.label(
              [
                ...attributes.label,
                h.DataAttribute('slot', 'label'),
                h.Class(recipe.label),
              ],
              [label],
            ),
            h.input([
              ...attributes.input,
              h.Autocomplete('off'),
              h.DataAttribute('slot', 'input'),
              h.Class(recipe.input),
            ]),
          ],
        ),
    },
    h,
  )
