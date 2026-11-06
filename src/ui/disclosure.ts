import type { Html, HtmlBuilder } from 'foldkit/html'

import { Disclosure as HeadlessDisclosure } from '@foldkit/ui'

export type ViewConfig<Message> = Readonly<{
  id: string
  summary: ReadonlyArray<Html | string>
  content: ReadonlyArray<Html | string>
  isOpen: boolean
  onToggle: (isOpen: boolean) => Message
}>

const recipe = {
  root: 'flex flex-col gap-3',
  button:
    'flex w-full cursor-pointer items-center justify-between rounded-control border border-border bg-surface px-3 py-2 text-sm font-medium text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
  indicator: 'text-fg-muted',
  panel: 'flex flex-col gap-4',
}

export const view = <Message>(
  { id, summary, content, isOpen, onToggle }: ViewConfig<Message>,
  h: HtmlBuilder<Message>,
): Html =>
  HeadlessDisclosure.view(
    {
      id,
      isOpen,
      onToggle,
      toView: attributes =>
        h.div(
          [h.DataAttribute('slot', 'disclosure'), h.Class(recipe.root)],
          [
            h.button(
              [
                ...attributes.button,
                h.DataAttribute('slot', 'button'),
                h.Class(recipe.button),
              ],
              [
                h.span([], summary),
                h.span(
                  [h.AriaHidden(true), h.Class(recipe.indicator)],
                  [isOpen ? '−' : '+'],
                ),
              ],
            ),
            h.div(
              [
                ...attributes.panel,
                h.DataAttribute('slot', 'panel'),
                h.Class(recipe.panel),
              ],
              content,
            ),
          ],
        ),
    },
    h,
  )
