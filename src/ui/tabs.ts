import { Array, Option } from 'effect'
import type { Html, HtmlBuilder } from 'foldkit/html'

import { Tabs as HeadlessTabs } from '@foldkit/ui'

export const Model = HeadlessTabs.Model
export type Model = HeadlessTabs.Model
export const Message = HeadlessTabs.Message
export type Message = HeadlessTabs.Message
export const OutMessage = HeadlessTabs.OutMessage
export type OutMessage<Value extends string> = HeadlessTabs.OutMessage<Value>

export const init = (id: string): Model => HeadlessTabs.init({ id })
export const { FocusTab } = HeadlessTabs

export type Tab<Value extends string> = Readonly<{
  value: Value
  label: string
}>

export const { create } = HeadlessTabs
export type Bundle<Value extends string> = HeadlessTabs.Bundle<Value>

export type ViewConfig<Value extends string, ParentMessage> = Readonly<{
  bundle: Bundle<Value>
  slotId: string
  model: Model
  toParentMessage: (message: Message) => ParentMessage
  ariaLabel: string
  tabs: ReadonlyArray<Tab<Value>>
  selected: Value
  panel: (value: Value) => ReadonlyArray<Html>
}>

const recipe = {
  root: 'flex flex-col gap-4',
  list: 'flex gap-1 border-b border-border',
  tab: 'cursor-pointer border-b-2 border-transparent px-3 py-2 text-sm font-medium text-fg-muted hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus data-[selected]:border-accent data-[selected]:text-fg',
  panel: 'flex flex-col gap-3',
}

const labelOf = <Value extends string>(
  tabs: ReadonlyArray<Tab<Value>>,
  value: Value,
): string =>
  Option.getOrElse(
    Option.map(
      Array.findFirst(tabs, tab => tab.value === value),
      ({ label }) => label,
    ),
    () => value,
  )

export const view = <Value extends string, ParentMessage>(
  {
    bundle,
    slotId,
    model,
    toParentMessage,
    ariaLabel,
    tabs,
    selected,
    panel,
  }: ViewConfig<Value, ParentMessage>,
  h: HtmlBuilder<ParentMessage>,
): Html =>
  h.submodel({
    slotId,
    model,
    view: bundle.view,
    viewInputs: {
      tabs: Array.map(tabs, ({ value }) => value),
      selectedValue: selected,
      ariaLabel,
      toView: render =>
        h.div(
          [h.DataAttribute('slot', 'tabs'), h.Class(recipe.root)],
          [
            h.div(
              [
                ...render.tablist,
                h.DataAttribute('slot', 'tablist'),
                h.Class(recipe.list),
              ],
              Array.map(render.tabs, tab =>
                h.button(
                  [
                    ...tab.tab,
                    h.DataAttribute('slot', 'tab'),
                    h.Class(recipe.tab),
                  ],
                  [labelOf(tabs, tab.value)],
                ),
              ),
            ),
            ...Array.map(
              Array.filter(render.tabs, tab => tab.isActive),
              tab =>
                h.div(
                  [
                    ...tab.panel,
                    h.DataAttribute('slot', 'panel'),
                    h.Class(recipe.panel),
                  ],
                  panel(tab.value),
                ),
            ),
          ],
        ),
    },
    toParentMessage,
  })
