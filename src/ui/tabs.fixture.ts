import { Option, Schema } from 'effect'
import { Update } from 'foldkit'
import type { Html, HtmlBuilder } from 'foldkit/html'
import { defineMessageUnion } from 'foldkit/message'
import { modifyFields } from 'foldkit/struct'

import * as Tabs from './tabs'

const Panel = Schema.Literals(['Stats', 'Add'])
type Panel = typeof Panel.Type

const PanelTabs = Tabs.create<Panel>()

export const Model = Schema.Struct({ tabs: Tabs.Model, selected: Panel })
export type Model = typeof Model.Type

export const Message = defineMessageUnion({
  ClickedJumpToAdd: {},
  GotTabsMessage: { message: Tabs.Message },
})
export type Message = typeof Message.Type

export const initialModel: Model = {
  tabs: Tabs.init('panel-tabs'),
  selected: 'Stats',
}

const foldTabsOutMessage = Tabs.OutMessage.match<
  Update.Step<Model, Message>,
  Tabs.OutMessage<Panel>
>({
  Selected:
    ({ value }) =>
    stepModel => ({
      model: modifyFields(stepModel, { selected: () => value }),
    }),
})

const foldTabs = Update.foldChild({
  update: PanelTabs.update,
  read: (model: Model) => Option.some(model.tabs),
  write: (model: Model, nextTabs: Tabs.Model): Model =>
    modifyFields(model, { tabs: () => nextTabs }),
  toParentMessage: (message: Tabs.Message) =>
    Message.GotTabsMessage({ message }),
  foldOutMessage: foldTabsOutMessage,
})

export const update = (model: Model, message: Message) =>
  Message.match<Update.Return<Model, Message>>(message, {
    ClickedJumpToAdd: () => ({
      model: modifyFields(model, { selected: () => 'Add' }),
    }),
    GotTabsMessage: ({ message }) => foldTabs(model, message),
  })

export const view = (model: Model, h: HtmlBuilder<Message>): Html =>
  h.div(
    [],
    [
      Tabs.view(
        {
          bundle: PanelTabs,
          slotId: 'panel-tabs',
          model: model.tabs,
          toParentMessage: message => Message.GotTabsMessage({ message }),
          ariaLabel: 'Deck tools',
          tabs: [
            { value: 'Stats', label: 'Deck stats' },
            { value: 'Add', label: 'Add cards' },
          ],
          selected: model.selected,
          panel: value => [
            h.p([], [value === 'Stats' ? 'Stats panel' : 'Add panel']),
          ],
        },
        h,
      ),
      h.button(
        [h.Type('button'), h.OnClick(Message.ClickedJumpToAdd())],
        ['Jump to add'],
      ),
    ],
  )
