import { Array } from 'effect'
import { FieldValidation } from 'foldkit'
import type { Field } from 'foldkit/fieldValidation'
import type { Html, HtmlBuilder } from 'foldkit/html'

import { Input } from '@foldkit/ui'

export type Type = 'text' | 'email' | 'password'

export type ViewConfig<Message> = Readonly<{
  id: string
  label: string
  field: Field<string>
  onInput: (value: string) => Message
  type?: Type
  autocomplete?: string
}>

const recipe = {
  root: 'flex flex-col gap-1',
  label: 'text-sm font-medium text-fg',
  input:
    'rounded-control border border-border bg-surface px-3 py-2 text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus aria-[invalid=true]:border-danger',
  error: 'text-sm text-danger',
  defaults: { type: 'text' } satisfies Readonly<{ type: Type }>,
}

export const view = <Message>(
  {
    id,
    label,
    field,
    onInput,
    type = recipe.defaults.type,
    autocomplete,
  }: ViewConfig<Message>,
  h: HtmlBuilder<Message>,
): Html => {
  const isInvalid = FieldValidation.isInvalid(field)

  return Input.view(
    {
      id,
      type,
      value: field.value,
      onInput,
      isInvalid,
      hasDescription: isInvalid,
      toView: attributes =>
        h.div(
          [h.DataAttribute('slot', 'text-field'), h.Class(recipe.root)],
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
              ...(autocomplete === undefined
                ? []
                : [h.Autocomplete(autocomplete)]),
              h.DataAttribute('slot', 'input'),
              h.Class(recipe.input),
            ]),
            FieldValidation.match(field, {
              onNotValidated: () => h.empty,
              onValidating: () => h.empty,
              onValid: () => h.empty,
              onInvalid: ({ errors }) =>
                h.p(
                  [
                    ...attributes.description,
                    h.DataAttribute('slot', 'error'),
                    h.Class(recipe.error),
                  ],
                  [Array.headNonEmpty(errors)],
                ),
            }),
          ],
        ),
    },
    h,
  )
}
