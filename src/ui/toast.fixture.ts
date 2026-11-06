import { Option, Schema } from 'effect'
import { Update } from 'foldkit'
import type { Html, HtmlBuilder } from 'foldkit/html'
import { defineMessageUnion } from 'foldkit/message'
import { modifyFields } from 'foldkit/struct'

import * as Button from './button'
import * as Toast from './toast'

export const Model = Schema.Struct({ toast: Toast.Notification.Model })
export type Model = typeof Model.Type

export const Message = defineMessageUnion({
  GotToastMessage: { message: Toast.Notification.Message },
  ClickedAdd: {},
})
export type Message = typeof Message.Type

export const initialModel: Model = { toast: Toast.init('fixture-toast') }

const toastFold = {
  read: (model: Model) => Option.some(model.toast),
  write: (model: Model, nextToast: Toast.Model): Model =>
    modifyFields(model, { toast: () => nextToast }),
  toParentMessage: (message: Toast.Message) =>
    Message.GotToastMessage({ message }),
  foldOutMessage: Toast.Notification.OutMessage.match<
    Update.Step<Model, Message>
  >({
    DismissedToast: () => stepModel => ({ model: stepModel }),
  }),
}

const foldToast = Update.foldChild({
  update: Toast.Notification.update,
  ...toastFold,
})
const showToast = Update.foldChild({
  update: Toast.Notification.show,
  ...toastFold,
})

export const update = (model: Model, message: Message) =>
  Message.match<Update.Return<Model, Message>>(message, {
    GotToastMessage: ({ message }) => foldToast(model, message),
    ClickedAdd: () =>
      showToast(model, {
        variant: 'Success',
        payload: { text: 'Added Vi to Main deck' },
      }),
  })

export const view = (model: Model, h: HtmlBuilder<Message>): Html =>
  h.div(
    [],
    [
      Button.view({ content: ['Add'], onClick: Message.ClickedAdd() }, h),
      Toast.view(
        {
          slotId: 'fixture-toast',
          model: model.toast,
          toParentMessage: message => Message.GotToastMessage({ message }),
        },
        h,
      ),
    ],
  )
