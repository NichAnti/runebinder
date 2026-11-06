import { Schema } from 'effect'

export const CatalogueIssue = Schema.TaggedUnion({
  InvalidRecord: { index: Schema.Int, message: Schema.String },
  InvalidId: { id: Schema.String },
  IdMismatch: {
    id: Schema.String,
    field: Schema.Literals(['set', 'collectorNumber']),
    expected: Schema.String,
    actual: Schema.String,
  },
  MultipleTypes: { id: Schema.String },
  InvalidCardName: { id: Schema.String, name: Schema.String },
  DuplicateId: { id: Schema.String },
  AmbiguousCardTraderBlueprint: {
    id: Schema.String,
    blueprintIds: Schema.Array(Schema.Int),
  },
  UnnamedCardTraderBlueprint: {
    id: Schema.String,
    blueprintId: Schema.Int,
  },
})
export type CatalogueIssue = typeof CatalogueIssue.Type
