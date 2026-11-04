import { Schema } from 'effect'
import { defineTaggedUnion } from 'foldkit/schema'

import { Printing } from '../../../../domain'

export const Showcase = defineTaggedUnion({
  NotAsked: {},
  Loading: {},
  Ready: { printings: Schema.Record(Printing.PrintingId, Printing.Printing) },
  Failed: {},
})
export type Showcase = typeof Showcase.Type

export const Model = Schema.Struct({ showcase: Showcase })
export type Model = typeof Model.Type

export const init = (): Model => ({ showcase: Showcase.NotAsked() })
