import { Array, Option, Record, Result, String, pipe } from 'effect'

import { Printing } from '../../../domain'
import { CatalogueIssue } from '../issue'
import type { Blueprint } from './schema'

const PRINTING_NUMBER_PATTERN = /^[a-z]+-(r|sp|t)?(\d+)(a)?(-star)?(?:-\d+)?$/
const FACE_SEPARATOR = ' // '
const TOTAL_SUFFIX = /\/\d+$/

export const collectorNumberOf = (
  id: Printing.PrintingId,
): Option.Option<string> =>
  pipe(
    Option.fromNullishOr(PRINTING_NUMBER_PATTERN.exec(id)),
    Option.map(
      ([, prefix, number, alternateArt, star]) =>
        `${String.toUpperCase(prefix ?? '')}${number ?? ''}${alternateArt ?? ''}${star === undefined ? '' : 's'}`,
    ),
  )

export const facesOf = (collectorNumber: string): ReadonlyArray<string> =>
  pipe(
    String.split(FACE_SEPARATOR)(collectorNumber),
    Array.map(face => String.replace(TOTAL_SUFFIX, '')(String.trim(face))),
  )

type BlueprintIndex = Readonly<{
  singleFaced: Readonly<Record<string, ReadonlyArray<number>>>
  multiFaced: Readonly<Record<string, ReadonlyArray<number>>>
}>

const indexOf = (
  blueprints: ReadonlyArray<Blueprint>,
  isMultiFaced: boolean,
): Readonly<Record<string, ReadonlyArray<number>>> =>
  pipe(
    blueprints,
    Array.flatMap(blueprint =>
      pipe(
        Option.fromNullishOr(blueprint.fixed_properties.collector_number),
        Option.map(facesOf),
        Option.filter(faces => Array.length(faces) > 1 === isMultiFaced),
        Option.match({
          onNone: () => [],
          onSome: faces =>
            Array.map(faces, (face): readonly [string, number] => [
              face,
              blueprint.id,
            ]),
        }),
      ),
    ),
    Array.groupBy(([face]) => face),
    Record.map(entries => Array.map(entries, ([, id]) => id)),
  )

export const indexBlueprints = (
  blueprints: ReadonlyArray<Blueprint>,
): BlueprintIndex => ({
  singleFaced: indexOf(blueprints, false),
  multiFaced: indexOf(blueprints, true),
})

export type MatchOutcome =
  | Readonly<{ _tag: 'Matched'; blueprintId: Printing.CardTraderBlueprintId }>
  | Readonly<{ _tag: 'Unmatched' }>
  | Readonly<{ _tag: 'Ambiguous'; blueprintIds: ReadonlyArray<number> }>

export const matchPrinting = (
  index: BlueprintIndex,
  printing: Printing.Printing,
): MatchOutcome =>
  pipe(
    collectorNumberOf(printing.id),
    Option.map(number =>
      Option.getOrElse(Option.fromNullishOr(index.singleFaced[number]), () =>
        Option.getOrElse(
          Option.fromNullishOr(index.multiFaced[number]),
          () => [],
        ),
      ),
    ),
    Option.getOrElse((): ReadonlyArray<number> => []),
    ids =>
      Array.match(ids, {
        onEmpty: (): MatchOutcome => ({ _tag: 'Unmatched' }),
        onNonEmpty: ([first, ...rest]): MatchOutcome =>
          Array.isReadonlyArrayEmpty(rest)
            ? {
                _tag: 'Matched',
                blueprintId: Printing.CardTraderBlueprintId.make(first),
              }
            : { _tag: 'Ambiguous', blueprintIds: ids },
      }),
  )

export type MatchReport = Readonly<{
  printings: ReadonlyArray<Printing.Printing>
  unmatched: ReadonlyArray<Printing.PrintingId>
}>

export const withBlueprints = (
  printings: ReadonlyArray<Printing.Printing>,
  blueprintsBySet: Readonly<Record<string, ReadonlyArray<Blueprint>>>,
): Result.Result<MatchReport, Array.NonEmptyReadonlyArray<CatalogueIssue>> => {
  const indexes = Record.map(blueprintsBySet, indexBlueprints)

  const outcomes = Array.map(printings, printing => ({
    printing,
    outcome: Option.match(Option.fromNullishOr(indexes[printing.set]), {
      onNone: (): MatchOutcome => ({ _tag: 'Unmatched' }),
      onSome: index => matchPrinting(index, printing),
    }),
  }))

  const issues = Array.filterMap(outcomes, ({ printing, outcome }) =>
    outcome._tag === 'Ambiguous'
      ? Result.succeed(
          CatalogueIssue.cases.AmbiguousCardTraderBlueprint.make({
            id: printing.id,
            blueprintIds: Array.fromIterable(outcome.blueprintIds),
          }),
        )
      : Result.failVoid,
  )

  if (Array.isReadonlyArrayNonEmpty(issues)) {
    return Result.fail(issues)
  } else {
    return Result.succeed({
      printings: Array.map(outcomes, ({ printing, outcome }) => ({
        ...printing,
        maybeCardTraderBlueprintId:
          outcome._tag === 'Matched'
            ? Option.some(outcome.blueprintId)
            : Option.none(),
      })),
      unmatched: Array.filterMap(outcomes, ({ printing, outcome }) =>
        outcome._tag === 'Unmatched'
          ? Result.succeed(printing.id)
          : Result.failVoid,
      ),
    })
  }
}
