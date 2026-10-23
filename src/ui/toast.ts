import { Duration, Schema } from 'effect'
import type { Html, HtmlBuilder } from 'foldkit/html'

import { Toast as HeadlessToast } from '@foldkit/ui'

const DEFAULT_DURATION = Duration.seconds(3)

export const Payload = Schema.Struct({ text: Schema.String })
export type Payload = typeof Payload.Type

export const Notification = HeadlessToast.make(Payload)
export type Model = typeof Notification.Model.Type
export type Message = typeof Notification.Message.Type

export const init = (id: string): Model =>
  Notification.init({ id, defaultDuration: DEFAULT_DURATION })

export type ViewConfig<ParentMessage> = Readonly<{
  slotId: string
  model: Model
  toParentMessage: (message: Message) => ParentMessage
}>

const recipe = {
  entry: 'w-80 max-w-[calc(100vw-2rem)]',
  body: 'flex items-center gap-3 rounded-card border border-border bg-surface-raised px-4 py-3 text-sm text-fg shadow-raised',
  text: 'flex-1',
  dismiss:
    'cursor-pointer rounded-control px-1 text-fg-muted hover:text-fg focus-visible:outline-2 focus-visible:outline-focus',
}

export const view = <ParentMessage>(
  { slotId, model, toParentMessage }: ViewConfig<ParentMessage>,
  h: HtmlBuilder<ParentMessage>,
): Html =>
  h.submodel({
    slotId,
    model,
    view: Notification.view,
    viewInputs: {
      position: 'BottomCenter',
      ariaLabel: 'Notifications',
      entryClassName: recipe.entry,
      entryToView: (entry, handlers) =>
        h.div(
          [h.DataAttribute('slot', 'toast'), h.Class(recipe.body)],
          [
            h.p([h.Class(recipe.text)], [entry.payload.text]),
            h.button(
              [
                ...handlers.dismiss,
                h.Type('button'),
                h.AriaLabel('Dismiss'),
                h.DataAttribute('slot', 'dismiss'),
                h.Class(recipe.dismiss),
              ],
              ['×'],
            ),
          ],
        ),
    },
    toParentMessage,
  })
