import type { Html, HtmlBuilder } from 'foldkit/html'

import { Button as HeadlessButton } from '@foldkit/ui'

export type ViewConfig<Message> = Readonly<{
  content: ReadonlyArray<Html | string>
  count: number
  isSelected: boolean
  onToggle: Message
}>

const recipe = {
  base: 'inline-flex cursor-pointer items-center gap-1.5 rounded-control border px-2 py-1 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus data-[disabled]:cursor-not-allowed data-[disabled]:opacity-40',
  unselected:
    'border-border bg-surface text-fg hover:not-data-[disabled]:bg-surface-raised',
  selected: 'border-accent bg-accent text-accent-fg',
  count: 'text-xs tabular-nums opacity-70',
}

export const view = <Message>(
  { content, count, isSelected, onToggle }: ViewConfig<Message>,
  h: HtmlBuilder<Message>,
): Html =>
  HeadlessButton.view(
    {
      onClick: onToggle,
      isDisabled: count === 0 && !isSelected,
      toView: attributes =>
        h.button(
          [
            ...attributes.button,
            h.AriaPressed(isSelected ? 'true' : 'false'),
            h.DataAttribute('slot', 'filter-chip'),
            h.Class(
              `${recipe.base} ${isSelected ? recipe.selected : recipe.unselected}`,
            ),
          ],
          [
            ...content,
            ' ',
            h.span(
              [h.DataAttribute('slot', 'count'), h.Class(recipe.count)],
              [`${count}`],
            ),
          ],
        ),
    },
    h,
  )
