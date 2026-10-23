import { Effect, Result } from 'effect'

import { Catalogue, Printing } from '../../domain'
import { withBlueprints } from './cardTrader/match'
import {
  RECORDING_DIRECTORY,
  readBlueprints,
  readExpansionCodes,
} from './cardTrader/recording'
import { CatalogueSource, RejectedRecords } from './source'

export type BuildResult = Readonly<{
  catalogue: Catalogue.Catalogue
  printingsNotOnCardTrader: ReadonlyArray<Printing.PrintingId>
}>

export const buildCatalogue = Effect.gen(function* () {
  const source = yield* CatalogueSource
  const printings = yield* source.printings
  const blueprintsBySet = yield* readBlueprints(RECORDING_DIRECTORY)
  const expansionCodes = yield* readExpansionCodes(RECORDING_DIRECTORY)

  const report = yield* Result.match(
    withBlueprints(printings, blueprintsBySet, expansionCodes),
    {
      onSuccess: Effect.succeed,
      onFailure: issues => Effect.fail(new RejectedRecords({ issues })),
    },
  )

  return {
    catalogue: Catalogue.Catalogue.make({
      source: source.name,
      printings: report.printings,
    }),
    printingsNotOnCardTrader: report.unmatched,
  } satisfies BuildResult
})
