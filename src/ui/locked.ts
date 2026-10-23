import type { Html, HtmlBuilder } from 'foldkit/html'

import { Button as HeadlessButton } from '@foldkit/ui'

import * as Icon from './icon'

export type Variant = 'Block' | 'Inline'

export type ViewConfig<Message> = Readonly<{
  content: ReadonlyArray<Html>
  isLocked: boolean
  unlockLabel: string
  onUnlock: Message
  variant?: Variant
}>

const recipe = {
  root: 'relative',
  content: {
    base: '',
    locked: 'pointer-events-none select-none opacity-40',
  },
  overlay: {
    base: 'absolute inset-0 flex items-center justify-center',
    variants: {
      Block: 'p-4',
      Inline: '',
    } satisfies Record<Variant, string>,
  },
  unlock: {
    base: 'inline-flex cursor-pointer items-center justify-center gap-2 rounded-control border border-border bg-surface font-semibold text-fg shadow-raised hover:bg-surface-raised focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
    variants: {
      Block: 'px-3 py-2 text-sm',
      Inline: 'size-9',
    } satisfies Record<Variant, string>,
  },
  defaults: { variant: 'Block' } satisfies Readonly<{ variant: Variant }>,
}

export const view = <Message>(
  {
    content,
    isLocked,
    unlockLabel,
    onUnlock,
    variant = recipe.defaults.variant,
  }: ViewConfig<Message>,
  h: HtmlBuilder<Message>,
): Html =>
  h.div(
    [
      h.DataAttribute('slot', 'locked'),
      ...(isLocked ? [h.DataAttribute('locked', '')] : []),
      h.Class(recipe.root),
    ],
    [
      h.div(
        [
          h.DataAttribute('slot', 'content'),
          ...(isLocked
            ? [
                h.Inert(true),
                h.AriaHidden(true),
                h.Class(recipe.content.locked),
              ]
            : [h.Class(recipe.content.base)]),
        ],
        content,
      ),
      ...(isLocked
        ? [
            h.div(
              [
                h.DataAttribute('slot', 'overlay'),
                h.Class(
                  `${recipe.overlay.base} ${recipe.overlay.variants[variant]}`,
                ),
              ],
              [
                HeadlessButton.view(
                  {
                    onClick: onUnlock,
                    toView: button =>
                      h.button(
                        [
                          ...button.button,
                          ...(variant === 'Inline'
                            ? [h.AriaLabel(unlockLabel), h.Title(unlockLabel)]
                            : []),
                          h.DataAttribute('slot', 'unlock'),
                          h.Class(
                            `${recipe.unlock.base} ${recipe.unlock.variants[variant]}`,
                          ),
                        ],
                        variant === 'Inline'
                          ? [Icon.view({ name: 'LockClosed' })]
                          : [
                              Icon.view({ name: 'LockClosed', size: 'Small' }),
                              unlockLabel,
                            ],
                      ),
                  },
                  h,
                ),
              ],
            ),
          ]
        : []),
    ],
  )
