import { Array, Number } from 'effect'
import type { Html, HtmlBuilder } from 'foldkit/html'

export type Column = Readonly<{
  label: string
  value: number
  description: string
}>

export type ViewConfig = Readonly<{
  title: string
  columns: ReadonlyArray<Column>
}>

const PLOT_HEIGHT_REM = 4

const recipe = {
  root: 'flex flex-col gap-2',
  title: 'text-xs font-medium text-fg-muted',
  plot: 'flex items-end gap-0.5',
  column: 'flex w-8 flex-col items-center gap-1',
  track: 'flex w-full items-end',
  bar: 'w-full rounded-t-[4px] bg-accent',
  empty: 'h-px w-full bg-border',
  label: 'text-xs tabular-nums text-fg-muted',
}

export const view = <Message>(
  { title, columns }: ViewConfig,
  h: HtmlBuilder<Message>,
): Html => {
  const highest = Number.max(
    1,
    Array.reduce(columns, 0, (most, { value }) => Number.max(most, value)),
  )

  return h.figure(
    [h.DataAttribute('slot', 'column-chart'), h.Class(recipe.root)],
    [
      h.figcaption(
        [h.DataAttribute('slot', 'title'), h.Class(recipe.title)],
        [title],
      ),
      h.ul(
        [h.AriaLabel(title), h.Class(recipe.plot)],
        Array.map(columns, ({ label, value, description }) =>
          h.keyed('li')(
            label,
            [
              h.AriaLabel(description),
              h.Title(description),
              h.DataAttribute('slot', 'column'),
              h.Class(recipe.column),
            ],
            [
              h.span(
                [
                  h.Class(recipe.track),
                  h.Style({ height: `${PLOT_HEIGHT_REM}rem` }),
                ],
                [
                  value === 0
                    ? h.span([h.Class(recipe.empty)])
                    : h.span([
                        h.DataAttribute('slot', 'bar'),
                        h.Class(recipe.bar),
                        h.Style({
                          height: `${(value / highest) * PLOT_HEIGHT_REM}rem`,
                        }),
                      ]),
                ],
              ),
              h.span([h.AriaHidden(true), h.Class(recipe.label)], [label]),
            ],
          ),
        ),
      ),
    ],
  )
}
