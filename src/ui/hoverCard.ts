import { Option } from 'effect'
import type { Html, HtmlBuilder } from 'foldkit/html'
import type { MountAction } from 'foldkit/mount'

import { HoverIntent } from '@foldkit/ui'

export type ViewConfig<Message> = Readonly<{
  id: string
  label: string
  hoverIntent: HoverIntent.Model
  toHoverIntentMessage: (message: HoverIntent.Message) => Message
  trigger: ReadonlyArray<Html | string>
  onClick: Message
  isOpen: boolean
  isPinned: boolean
  onDismiss: Message
  anchorPanel: MountAction<Message>
  panel: ReadonlyArray<Html | string>
}>

const ESCAPE = 'Escape'

const recipe = {
  root: 'relative',
  trigger:
    'block w-full cursor-pointer rounded-card text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
  backdrop: 'fixed inset-0 z-40',
  panel:
    'z-50 w-80 max-w-[calc(100vw-2rem)] rounded-card border border-border bg-surface p-4 text-fg shadow-raised focus-visible:outline-2 focus-visible:outline-focus',
}

export const panelId = (id: string): string => `${id}-panel`
export const triggerId = (id: string): string => `${id}-trigger`

export const view = <Message>(
  {
    id,
    label,
    hoverIntent,
    toHoverIntentMessage,
    trigger,
    onClick,
    isOpen,
    isPinned,
    onDismiss,
    anchorPanel,
    panel,
  }: ViewConfig<Message>,
  h: HtmlBuilder<Message>,
): Html =>
  h.submodel({
    slotId: id,
    model: hoverIntent,
    view: HoverIntent.view,
    viewInputs: {
      focusTriggerSelector: `#${triggerId(id)}`,
      toView: render =>
        h.div(
          [h.DataAttribute('slot', 'hover-card'), h.Class(recipe.root)],
          [
            h.button(
              [
                ...render.trigger,
                h.Type('button'),
                h.Id(triggerId(id)),
                h.AriaLabel(label),
                h.AriaHasPopup('dialog'),
                h.AriaExpanded(isOpen),
                h.AriaControls(panelId(id)),
                h.OnClick(onClick),
                h.DataAttribute('slot', 'trigger'),
                h.Class(recipe.trigger),
              ],
              trigger,
            ),
            ...(isOpen && isPinned
              ? [
                  h.div([
                    h.OnClick(onDismiss),
                    h.DataAttribute('slot', 'backdrop'),
                    h.Class(recipe.backdrop),
                  ]),
                ]
              : []),
            ...(isOpen
              ? [
                  h.div(
                    [
                      ...render.panel,
                      h.Id(panelId(id)),
                      h.Role('dialog'),
                      h.AriaLabel(label),
                      h.Tabindex(-1),
                      h.Style({
                        position: 'absolute',
                        margin: '0',
                        visibility: 'hidden',
                      }),
                      h.OnMount(anchorPanel),
                      h.OnKeyDownPreventDefault(key =>
                        key === ESCAPE ? Option.some(onDismiss) : Option.none(),
                      ),
                      h.DataAttribute('slot', 'panel'),
                      h.Class(recipe.panel),
                    ],
                    panel,
                  ),
                ]
              : []),
          ],
        ),
    },
    toParentMessage: toHoverIntentMessage,
  })
