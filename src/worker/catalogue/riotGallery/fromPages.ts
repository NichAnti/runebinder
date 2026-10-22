import { Array, Result, Schema, pipe } from 'effect'

import type { Printing } from '../../../domain'
import { duplicateIds } from '../checks'
import { CatalogueIssue } from '../issue'
import { GalleryCard, GalleryPage } from './schema'
import { toPrinting } from './toPrinting'

const STRICT = { onExcessProperty: 'error' } as const

const decodePage = Schema.decodeUnknownResult(GalleryPage, STRICT)
const decodeCard = Schema.decodeUnknownResult(GalleryCard, STRICT)

const invalidRecord =
  (index: number) =>
  (error: Schema.SchemaError): CatalogueIssue =>
    CatalogueIssue.cases.InvalidRecord.make({ index, message: error.message })

export const printingsFromPages = (
  pages: ReadonlyArray<unknown>,
): Result.Result<
  ReadonlyArray<Printing.Printing>,
  Array.NonEmptyReadonlyArray<CatalogueIssue>
> => {
  const [decodedPages, pageIssues] = pipe(
    pages,
    Array.map((page, index) =>
      Result.mapError(decodePage(page), invalidRecord(index)),
    ),
    Array.separate,
  )

  const [printings, cardIssues] = pipe(
    decodedPages,
    Array.flatMap(page => page.data),
    Array.map((record, index) =>
      pipe(
        decodeCard(record),
        Result.mapError(invalidRecord(index)),
        Result.flatMap(toPrinting),
      ),
    ),
    Array.separate,
  )

  const issues = [...pageIssues, ...cardIssues, ...duplicateIds(printings)]

  if (Array.isReadonlyArrayNonEmpty(issues)) {
    return Result.fail(issues)
  } else {
    return Result.succeed(printings)
  }
}
