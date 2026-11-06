import { Schema } from 'effect'
import { defineTaggedUnion } from 'foldkit/schema'

import { Printing } from '../../../domain'

export const Counts = defineTaggedUnion({
  Loading: {},
  Failed: {},
  Ready: {
    quantities: Schema.Record(Printing.PrintingId, Schema.Int),
    max: Schema.Int,
  },
})
export type Counts = typeof Counts.Type
