import { Schema } from 'effect'
import { defineTaggedUnion } from 'foldkit/schema'

import { Deck } from '../../../domain'

export const Save = defineTaggedUnion({
  Waiting: { revision: Schema.Int },
  Saving: { revision: Schema.Int },
  Failed: { revision: Schema.Int },
})
export type Save = typeof Save.Type

export const Creation = defineTaggedUnion({
  Idle: {},
  Creating: {},
  Failed: {},
})
export type Creation = typeof Creation.Type

export const Removal = Schema.Literals(['Removing', 'Failed'])
export type Removal = typeof Removal.Type

export const Model = defineTaggedUnion({
  NotLoaded: {},
  Loading: {},
  Failed: {},
  Ready: {
    decks: Schema.Array(Deck.Deck),
    saves: Schema.Record(Deck.DeckId, Save),
    nextRevision: Schema.Int,
    creation: Creation,
    removals: Schema.Record(Deck.DeckId, Removal),
  },
})
export type Model = typeof Model.Type
export type Ready = typeof Model.Ready.Type

export const init = (): Model => Model.NotLoaded()
