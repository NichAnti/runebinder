import { Schema } from 'effect'
import { defineTaggedUnion } from 'foldkit/schema'

import { Printing } from '../../../domain'

export const CountKind = Schema.Literals(['Owned', 'InDeck'])
export type CountKind = typeof CountKind.Type

export const Counts = defineTaggedUnion({
  Loading: {},
  Failed: {},
  Ready: {
    kind: CountKind,
    quantities: Schema.Record(Printing.PrintingId, Schema.Int),
    max: Schema.Int,
  },
})
export type Counts = typeof Counts.Type
