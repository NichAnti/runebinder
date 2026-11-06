import { Array } from 'effect'
import type { Html, HtmlBuilder } from 'foldkit/html'

import { Dialog as HeadlessDialog } from '@foldkit/ui'

import * as Icon from './icon'

export const Model = HeadlessDialog.Model
export type Model = HeadlessDialog.Model
export const Message = HeadlessDialog.Message
export type Message = HeadlessDialog.Message
export const OutMessage = HeadlessDialog.OutMessage
export type OutMessage = HeadlessDialog.OutMessage

export const init = (id: string): Model => HeadlessDialog.init({ id })
export const {
  update,
  open,
  close,
  ShowDialog,
  CloseDialog,
  AcquireResources,
} = HeadlessDialog

export type ViewConfig<ParentMessage> = Readonly<{
  slotId: string
  model: Model
  toParentMessage: (message: Message) => ParentMessage
  title: string
  description: ReadonlyArray<Html | string>
  body?: ReadonlyArray<Html>
  actions?: ReadonlyArray<Html>
}>

const recipe = {
  dialog:
    'm-0 h-full max-h-none w-full max-w-none bg-transparent p-4 open:flex items-center justify-center',
  backdrop: 'fixed inset-0 bg-canvas/80 backdrop-blur-sm',
  panel:
    'relative flex w-full max-w-md flex-col gap-4 rounded-card border border-border bg-surface p-6 text-fg shadow-raised',
  header: 'flex items-start justify-between gap-4',
  title: 'text-lg font-semibold',
  dismiss:
    'cursor-pointer rounded-control p-1 text-fg-muted hover:text-fg focus-visible:outline-2 focus-visible:outline-focus',
  description: 'text-sm text-fg-muted',
  actions: 'flex flex-wrap justify-end gap-2',
}

export const view = <ParentMessage>(
  {
    slotId,
    model,
    toParentMessage,
    title,
    description,
    body = [],
    actions = [],
  }: ViewConfig<ParentMessage>,
  h: HtmlBuilder<ParentMessage>,
): Html =>
  h.submodel({
    slotId,
    model,
    view: HeadlessDialog.view,
    viewInputs: {
      hasDescription: true,
      toView: render =>
        h.dialog(
          [
            ...render.dialog,
            h.DataAttribute('slot', 'dialog'),
            h.Class(recipe.dialog),
          ],
          render.isVisible
            ? [
                h.div([
                  ...render.backdrop,
                  h.DataAttribute('slot', 'backdrop'),
                  h.Class(recipe.backdrop),
                ]),
                h.div(
                  [
                    ...render.panel,
                    h.DataAttribute('slot', 'panel'),
                    h.Class(recipe.panel),
                  ],
                  [
                    h.div(
                      [
                        h.DataAttribute('slot', 'header'),
                        h.Class(recipe.header),
                      ],
                      [
                        h.h2(
                          [
                            ...render.title,
                            h.DataAttribute('slot', 'title'),
                            h.Class(recipe.title),
                          ],
                          [title],
                        ),
                        h.button(
                          [
                            ...render.closeButton,
                            h.AriaLabel('Close'),
                            h.DataAttribute('slot', 'dismiss'),
                            h.Class(recipe.dismiss),
                          ],
                          [Icon.view({ name: 'XMark' })],
                        ),
                      ],
                    ),
                    h.p(
                      [
                        ...render.description,
                        h.DataAttribute('slot', 'description'),
                        h.Class(recipe.description),
                      ],
                      description,
                    ),
                    ...body,
                    ...Array.match(actions, {
                      onEmpty: () => [],
                      onNonEmpty: nonEmpty => [
                        h.div(
                          [
                            h.DataAttribute('slot', 'actions'),
                            h.Class(recipe.actions),
                          ],
                          nonEmpty,
                        ),
                      ],
                    }),
                  ],
                ),
              ]
            : [],
        ),
    },
    toParentMessage,
  })
