import type { Html, HtmlBuilder } from 'foldkit/html'

import { Button as HeadlessButton } from '@foldkit/ui'

export type Status = 'Done' | 'Unfinished' | 'Problem'

export type ViewConfig<Message> = Readonly<{
  label: string
  value: string
  status: Status
  onClick: Message
}>

const STATUS_TEXT: Readonly<Record<Status, string>> = {
  Done: 'done',
  Unfinished: 'not finished',
  Problem: 'has a problem',
}

const STATUS_MARK: Readonly<Record<Status, string>> = {
  Done: '✓',
  Unfinished: '',
  Problem: '⚠',
}

const recipe = {
  base: 'inline-flex cursor-pointer items-center gap-1.5 rounded-control border px-2.5 py-1 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
  variants: {
    Done: 'border-success bg-surface text-fg hover:bg-surface-raised',
    Unfinished:
      'border-border bg-surface text-fg-muted hover:bg-surface-raised',
    Problem: 'border-danger bg-surface text-fg hover:bg-surface-raised',
  } satisfies Record<Status, string>,
  label: 'font-medium',
  value: 'tabular-nums',
  mark: {
    Done: 'text-success',
    Unfinished: '',
    Problem: 'text-danger',
  } satisfies Record<Status, string>,
}

export const view = <Message>(
  { label, value, status, onClick }: ViewConfig<Message>,
  h: HtmlBuilder<Message>,
): Html =>
  HeadlessButton.view(
    {
      onClick,
      toView: attributes =>
        h.button(
          [
            ...attributes.button,
            h.AriaLabel(`${label} ${value}, ${STATUS_TEXT[status]}`),
            h.DataAttribute('slot', 'progress-chip'),
            h.DataAttribute('status', status),
            h.Class(`${recipe.base} ${recipe.variants[status]}`),
          ],
          [
            h.span(
              [h.DataAttribute('slot', 'label'), h.Class(recipe.label)],
              [label],
            ),
            h.span(
              [h.DataAttribute('slot', 'value'), h.Class(recipe.value)],
              [value],
            ),
            STATUS_MARK[status] === ''
              ? h.empty
              : h.span(
                  [
                    h.AriaHidden(true),
                    h.DataAttribute('slot', 'mark'),
                    h.Class(recipe.mark[status]),
                  ],
                  [STATUS_MARK[status]],
                ),
          ],
        ),
    },
    h,
  )
