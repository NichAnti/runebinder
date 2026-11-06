import { Array, Record, pipe } from 'effect'

import type { Printing } from '../../domain'
import { CatalogueIssue } from './issue'

export const duplicateIds = (
  printings: ReadonlyArray<Printing.Printing>,
): ReadonlyArray<CatalogueIssue> =>
  pipe(
    printings,
    Array.groupBy(printing => printing.id),
    Record.toEntries,
    Array.filter(([, group]) => Array.length(group) > 1),
    Array.map(([id]) => CatalogueIssue.cases.DuplicateId.make({ id })),
  )
