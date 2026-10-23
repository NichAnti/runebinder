import { Option, Schema } from 'effect'
import { Update } from 'foldkit'
import type { Html, HtmlBuilder } from 'foldkit/html'
import { defineMessageUnion } from 'foldkit/message'
import { modifyFields } from 'foldkit/struct'

import * as Button from './button'
import * as Dialog from './dialog'

export const Model = Schema.Struct({
  dialog: Dialog.Model,
  deleteCount: Schema.Number,
})
export type Model = typeof Model.Type

export const Message = defineMessageUnion({
  ClickedOpen: {},
  ClickedDelete: {},
  GotDialogMessage: { message: Dialog.Message },
})
export type Message = typeof Message.Type

export const initialModel: Model = {
  dialog: Dialog.init('delete-dialog'),
  deleteCount: 0,
}

type UpdateReturn = Update.Return<Model, Message>

const dialogFold = {
  read: (model: Model) => Option.some(model.dialog),
  write: (model: Model, nextDialog: Dialog.Model): Model =>
    modifyFields(model, { dialog: () => nextDialog }),
  toParentMessage: (message: Dialog.Message) =>
    Message.GotDialogMessage({ message }),
  foldOutMessage: Dialog.OutMessage.match<Update.Step<Model, Message>>({
    Opened: () => stepModel => ({ model: stepModel }),
    Closed: () => stepModel => ({ model: stepModel }),
  }),
}

const foldDialog = Update.foldChild({ update: Dialog.update, ...dialogFold })
const openDialog = Update.foldChildStep({ update: Dialog.open, ...dialogFold })
const closeDialog = Update.foldChildStep({
  update: Dialog.close,
  ...dialogFold,
})

export const update = (model: Model, message: Message) =>
  Message.match<UpdateReturn>(message, {
    ClickedOpen: () => openDialog(model),
    ClickedDelete: () =>
      closeDialog(modifyFields(model, { deleteCount: count => count + 1 })),
    GotDialogMessage: ({ message }) => foldDialog(model, message),
  })

export const view = (model: Model, h: HtmlBuilder<Message>): Html =>
  h.div(
    [],
    [
      Button.view({ content: ['Delete…'], onClick: Message.ClickedOpen() }, h),
      Dialog.view(
        {
          slotId: 'delete-dialog',
          model: model.dialog,
          toParentMessage: message => Message.GotDialogMessage({ message }),
          title: 'Delete the wishlist?',
          description: ['This cannot be undone.'],
          actions: [
            Button.view(
              { content: ['Delete'], onClick: Message.ClickedDelete() },
              h,
            ),
          ],
        },
        h,
      ),
      h.p([], [`Deleted ${model.deleteCount}`]),
    ],
  )
