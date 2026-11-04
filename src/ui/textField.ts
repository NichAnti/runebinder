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
  variant?: Variant
}>

export type Variant = 'Default' | 'Title'

const recipe = {
  root: 'flex flex-col gap-1',
  label: {
    Default: 'text-sm font-medium text-fg',
    Title: 'sr-only',
  } satisfies Record<Variant, string>,
  input: {
    base: 'rounded-control text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus aria-[invalid=true]:border-danger',
    variants: {
      Default: 'border border-border bg-surface px-3 py-2',
      Title:
        'w-full border border-transparent bg-transparent px-1 py-0.5 text-2xl font-semibold hover:border-border focus:border-border focus:bg-surface',
    } satisfies Record<Variant, string>,
  },
  error: 'text-sm text-danger',
  defaults: { type: 'text', variant: 'Default' } satisfies Readonly<{
    type: Type
    variant: Variant
  }>,
}

export const view = <Message>(
  {
    id,
    label,
    field,
    onInput,
    type = recipe.defaults.type,
    autocomplete,
    variant = recipe.defaults.variant,
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
                h.Class(recipe.label[variant]),
              ],
              [label],
            ),
            h.input([
              ...attributes.input,
              ...(autocomplete === undefined
                ? []
                : [h.Autocomplete(autocomplete)]),
              h.DataAttribute('slot', 'input'),
              h.Class(`${recipe.input.base} ${recipe.input.variants[variant]}`),
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
