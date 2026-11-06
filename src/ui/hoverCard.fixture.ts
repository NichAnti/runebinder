import { Effect, Option, Schema } from 'effect'
import { Mount, Update } from 'foldkit'
import type { Html, HtmlBuilder } from 'foldkit/html'
import { defineMessageUnion } from 'foldkit/message'
import { modifyFields } from 'foldkit/struct'

import { HoverIntent } from '@foldkit/ui'

import * as HoverCard from './hoverCard'

export const Model = Schema.Struct({
  hoverIntent: HoverIntent.Model,
  isOpen: Schema.Boolean,
})
export type Model = typeof Model.Type

export const Message = defineMessageUnion({
  GotHoverIntentMessage: { message: HoverIntent.Message },
  ClickedTrigger: {},
  ClickedDismiss: {},
  CompletedPlacePanel: {},
})
export type Message = typeof Message.Type

export const PlacePanel = Mount.define('PlacePanel', {
  messages: [Message.CompletedPlacePanel],
  execute: ({ element }) =>
    Effect.sync(() => {
      element.setAttribute('data-placed', 'true')
      return Message.CompletedPlacePanel()
    }),
})

export const initialModel: Model = {
  hoverIntent: HoverIntent.init(),
  isOpen: false,
}

const foldHoverIntentOutMessage = HoverIntent.OutMessage.match<
  Update.Step<Model, Message>
>({
  Opened: () => stepModel => ({
    model: modifyFields(stepModel, { isOpen: () => true }),
  }),
  Closed: () => stepModel => ({ model: stepModel }),
})

const foldHoverIntent = Update.foldChild({
  update: HoverIntent.update,
  read: (model: Model) => Option.some(model.hoverIntent),
  write: (model: Model, nextHoverIntent: HoverIntent.Model): Model =>
    modifyFields(model, { hoverIntent: () => nextHoverIntent }),
  toParentMessage: message => Message.GotHoverIntentMessage({ message }),
  foldOutMessage: foldHoverIntentOutMessage,
})

export const update = (model: Model, message: Message) =>
  Message.match<Update.Return<Model, Message>>(message, {
    GotHoverIntentMessage: ({ message }) => foldHoverIntent(model, message),
    ClickedTrigger: () => ({
      model: modifyFields(model, { isOpen: isOpen => !isOpen }),
    }),
    ClickedDismiss: () => ({
      model: modifyFields(model, { isOpen: () => false }),
    }),
    CompletedPlacePanel: () => ({ model }),
  })

export const view = (model: Model, h: HtmlBuilder<Message>): Html =>
  HoverCard.view(
    {
      id: 'vi',
      label: 'Vi',
      hoverIntent: model.hoverIntent,
      toHoverIntentMessage: message =>
        Message.GotHoverIntentMessage({ message }),
      trigger: ['Vi'],
      onClick: Message.ClickedTrigger(),
      isOpen: model.isOpen,
      isPinned: model.isOpen,
      onDismiss: Message.ClickedDismiss(),
      anchorPanel: PlacePanel(),
      panel: [h.p([], ['Every printing of Vi'])],
    },
    h,
  )
