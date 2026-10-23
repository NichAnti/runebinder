import { Schema } from 'effect'
import { defineTaggedUnion } from 'foldkit/schema'

import { HoverIntent } from '@foldkit/ui'

import { Printing } from '../../../domain'

export const Opener = Schema.Literals(['Hover', 'Click'])
export type Opener = typeof Opener.Type

export const PanelCard = defineTaggedUnion({
  Loading: {},
  Found: { card: Printing.Card },
  Missing: {},
})
export type PanelCard = typeof PanelCard.Type

export const Panel = defineTaggedUnion({
  Closed: {},
  Open: { cardId: Printing.CardId, opener: Opener, card: PanelCard },
})
export type Panel = typeof Panel.Type

export const Model = Schema.Struct({
  hoverIntent: HoverIntent.Model,
  panel: Panel,
})
export type Model = typeof Model.Type

export const init = (): Model => ({
  hoverIntent: HoverIntent.init(),
  panel: Panel.Closed(),
})
