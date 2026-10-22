import { Context, type Effect, Schema } from 'effect'

import { Catalogue, Printing } from '../../domain'
import { CatalogueIssue } from './issue'

export class UnreadableRecording extends Schema.TaggedError<UnreadableRecording>()(
  'UnreadableRecording',
  { message: Schema.String },
) {}

export class RejectedRecords extends Schema.TaggedError<RejectedRecords>()(
  'RejectedRecords',
  { issues: Schema.NonEmptyArray(CatalogueIssue) },
) {}

export type CatalogueSourceError = UnreadableRecording | RejectedRecords

export class CatalogueSource extends Context.Service<
  CatalogueSource,
  {
    readonly name: Catalogue.Source
    readonly printings: Effect.Effect<
      ReadonlyArray<Printing.Printing>,
      CatalogueSourceError
    >
  }
>()('cardtrader/worker/catalogue/CatalogueSource') {}
