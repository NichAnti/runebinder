import { Array, Option, Record, Result, Schema, String, pipe } from 'effect'

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

const decodeSlug = Schema.decodeOption(Printing.CardTraderSlug)
const decodeExpansionCode = Schema.decodeOption(
  Printing.CardTraderExpansionCode,
)

export const cardTraderBlueprintOf = (
  blueprint: Blueprint,
  expansionCodes: Readonly<Record<string, string>>,
): Option.Option<Printing.CardTraderBlueprint> =>
  Option.all({
    id: Option.some(Printing.CardTraderBlueprintId.make(blueprint.id)),
    metaName: decodeSlug(Printing.slugify(blueprint.name)),
    expansionCode: Option.flatMap(
      Option.fromNullishOr(expansionCodes[`${blueprint.expansion_id}`]),
      decodeExpansionCode,
    ),
  })

type Resolved =
  | Readonly<{ _tag: 'Found'; blueprint: Printing.CardTraderBlueprint }>
  | Readonly<{ _tag: 'NotFound' }>
  | Readonly<{ _tag: 'Problem'; issue: CatalogueIssue }>

export const withBlueprints = (
  printings: ReadonlyArray<Printing.Printing>,
  blueprintsBySet: Readonly<Record<string, ReadonlyArray<Blueprint>>>,
  expansionCodes: Readonly<Record<string, string>>,
): Result.Result<MatchReport, Array.NonEmptyReadonlyArray<CatalogueIssue>> => {
  const indexes = Record.map(blueprintsBySet, indexBlueprints)
  const blueprintsById = new Map(
    Array.map(
      Array.flatten(Record.values(blueprintsBySet)),
      (blueprint): readonly [number, Blueprint] => [blueprint.id, blueprint],
    ),
  )

  const resolve = (printing: Printing.Printing): Resolved => {
    const outcome = Option.match(Option.fromNullishOr(indexes[printing.set]), {
      onNone: (): MatchOutcome => ({ _tag: 'Unmatched' }),
      onSome: index => matchPrinting(index, printing),
    })

    if (outcome._tag === 'Unmatched') {
      return { _tag: 'NotFound' }
    } else if (outcome._tag === 'Ambiguous') {
      return {
        _tag: 'Problem',
        issue: CatalogueIssue.cases.AmbiguousCardTraderBlueprint.make({
          id: printing.id,
          blueprintIds: Array.fromIterable(outcome.blueprintIds),
        }),
      }
    } else {
      return Option.match(
        Option.flatMap(
          Option.fromNullishOr(blueprintsById.get(outcome.blueprintId)),
          blueprint => cardTraderBlueprintOf(blueprint, expansionCodes),
        ),
        {
          onNone: (): Resolved => ({
            _tag: 'Problem',
            issue: CatalogueIssue.cases.UnnamedCardTraderBlueprint.make({
              id: printing.id,
              blueprintId: outcome.blueprintId,
            }),
          }),
          onSome: blueprint => ({ _tag: 'Found', blueprint }),
        },
      )
    }
  }

  const resolved = Array.map(printings, printing => ({
    printing,
    resolved: resolve(printing),
  }))

  const issues = Array.filterMap(resolved, ({ resolved }) =>
    resolved._tag === 'Problem'
      ? Result.succeed(resolved.issue)
      : Result.failVoid,
  )

  if (Array.isReadonlyArrayNonEmpty(issues)) {
    return Result.fail(issues)
  } else {
    return Result.succeed({
      printings: Array.map(resolved, ({ printing, resolved }) => ({
        ...printing,
        maybeCardTrader:
          resolved._tag === 'Found'
            ? Option.some(resolved.blueprint)
            : Option.none(),
      })),
      unmatched: Array.filterMap(resolved, ({ printing, resolved }) =>
        resolved._tag === 'NotFound'
          ? Result.succeed(printing.id)
          : Result.failVoid,
      ),
    })
  }
}
