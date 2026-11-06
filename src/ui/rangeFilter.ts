import { Number, Option, String } from 'effect'
import type { Html, HtmlBuilder } from 'foldkit/html'

import { Input } from '@foldkit/ui'

export type ViewConfig<Message> = Readonly<{
  id: string
  label: string
  maybeMin: Option.Option<number>
  maybeMax: Option.Option<number>
  onChangeMin: (value: Option.Option<number>) => Message
  onChangeMax: (value: Option.Option<number>) => Message
}>

const recipe = {
  root: 'flex flex-col gap-1',
  legend: 'text-sm font-medium text-fg',
  inputs: 'flex items-center gap-2',
  label: 'sr-only',
  input:
    'w-16 rounded-control border border-border bg-surface px-2 py-1 text-sm text-fg tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
  separator: 'text-fg-muted',
}

const toBound = (value: string): Option.Option<number> =>
  String.isEmpty(String.trim(value))
    ? Option.none()
    : Option.filter(Number.parse(value), bound => bound >= 0)

const boundView = <Message>(
  id: string,
  label: string,
  maybeValue: Option.Option<number>,
  onChange: (value: Option.Option<number>) => Message,
  h: HtmlBuilder<Message>,
): Html =>
  Input.view(
    {
      id,
      type: 'number',
      value: Option.match(maybeValue, {
        onNone: () => '',
        onSome: v => `${v}`,
      }),
      onInput: value => onChange(toBound(value)),
      toView: attributes =>
        h.span(
          [],
          [
            h.label([...attributes.label, h.Class(recipe.label)], [label]),
            h.input([
              ...attributes.input,
              h.Min('0'),
              h.Step('1'),
              h.InputMode('numeric'),
              h.DataAttribute('slot', 'input'),
              h.Class(recipe.input),
            ]),
          ],
        ),
    },
    h,
  )

export const view = <Message>(
  {
    id,
    label,
    maybeMin,
    maybeMax,
    onChangeMin,
    onChangeMax,
  }: ViewConfig<Message>,
  h: HtmlBuilder<Message>,
): Html =>
  h.fieldset(
    [h.DataAttribute('slot', 'range-filter'), h.Class(recipe.root)],
    [
      h.legend([h.Class(recipe.legend)], [label]),
      h.div(
        [h.Class(recipe.inputs)],
        [
          boundView(`${id}-min`, `Minimum ${label}`, maybeMin, onChangeMin, h),
          h.span([h.AriaHidden(true), h.Class(recipe.separator)], ['–']),
          boundView(`${id}-max`, `Maximum ${label}`, maybeMax, onChangeMax, h),
        ],
      ),
    ],
  )
