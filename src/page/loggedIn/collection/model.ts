import { Schema } from 'effect'
import { defineTaggedUnion } from 'foldkit/schema'

import { Collection, Printing } from '../../../domain'

export const Save = defineTaggedUnion({
  Waiting: { revision: Schema.Int },
  Saving: { revision: Schema.Int },
  Failed: { revision: Schema.Int },
})
export type Save = typeof Save.Type

export const Model = defineTaggedUnion({
  NotLoaded: {},
  Loading: {},
  Failed: {},
  Ready: {
    owned: Collection.Owned,
    saves: Schema.Record(Printing.PrintingId, Save),
    nextRevision: Schema.Int,
  },
})
export type Model = typeof Model.Type
export type Ready = typeof Model.Ready.Type

export const init = (): Model => Model.NotLoaded()
