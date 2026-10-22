import { Schema } from 'effect'
import { defineTaggedUnion } from 'foldkit/schema'

import { Printing } from '../../../../domain'

export const CardState = defineTaggedUnion({
  Waiting: {},
  Found: { card: Printing.Card },
  Missing: { cardId: Printing.CardId },
})
export type CardState = typeof CardState.Type

export const Model = Schema.Struct({ state: CardState })
export type Model = typeof Model.Type

export const init = (): Model => ({ state: CardState.Waiting() })
