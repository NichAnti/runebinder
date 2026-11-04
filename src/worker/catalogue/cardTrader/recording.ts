import {
  Array,
  Effect,
  FileSystem,
  Option,
  Order,
  Path,
  Record,
  Result,
  Schema,
  String,
  pipe,
} from 'effect'

import { CatalogueIssue } from '../issue'
import { RejectedRecords, UnreadableRecording } from '../source'
import { type Blueprint, BlueprintExport, ExpansionExport } from './schema'

export const RECORDING_DIRECTORY = 'catalogue/recordings/cardtrader'

const BLUEPRINT_FILE = /^blueprints-([a-z0-9]+)\.json$/

const EXPANSION_FILE = 'expansions.json'

export type BlueprintsBySet = Readonly<Record<string, ReadonlyArray<Blueprint>>>

/** One blueprint export as text, labelled for error messages. */
export type BlueprintText = Readonly<{
  label: string
  set: string
  json: string
}>

const decodeExpansions = Schema.decodeUnknownEffect(
  Schema.fromJsonString(ExpansionExport),
  { onExcessProperty: 'error' },
)

const decodeExport = Schema.decodeUnknownResult(
  Schema.fromJsonString(BlueprintExport),
  { onExcessProperty: 'error' },
)

/** Expansion ids to codes, from the text of CardTrader's `/expansions`. */
export const expansionCodesFrom = (json: string) =>
  decodeExpansions(json).pipe(
    Effect.map(expansions =>
      Record.fromEntries(
        Array.map(expansions, ({ id, code }): readonly [string, string] => [
          `${id}`,
          code,
        ]),
      ),
    ),
    Effect.mapError(
      error =>
        new RejectedRecords({
          issues: [
            CatalogueIssue.cases.InvalidRecord.make({
              index: 0,
              message: `${EXPANSION_FILE}: ${error.message}`,
            }),
          ],
        }),
    ),
  )

/** Every blueprint export parsed strictly; any failure rejects them all. */
export const blueprintsFrom = (
  texts: ReadonlyArray<BlueprintText>,
): Effect.Effect<BlueprintsBySet, RejectedRecords> => {
  const [sets, issues] = Array.separate(
    Array.map(texts, ({ label, set, json }, index) =>
      Result.mapError(
        Result.map(
          decodeExport(json),
          (blueprints): readonly [string, ReadonlyArray<Blueprint>] => [
            set,
            blueprints,
          ],
        ),
        error =>
          CatalogueIssue.cases.InvalidRecord.make({
            index,
            message: `${label}: ${error.message}`,
          }),
      ),
    ),
  )

  return Array.isReadonlyArrayNonEmpty(issues)
    ? Effect.fail(new RejectedRecords({ issues }))
    : Effect.succeed(Record.fromEntries(sets))
}

const unreadable = (error: unknown) =>
  new UnreadableRecording({ message: globalThis.String(error) })

export const readExpansionCodes = (directory: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const json = yield* fs
      .readFileString(path.join(directory, EXPANSION_FILE))
      .pipe(Effect.mapError(unreadable))

    return yield* expansionCodesFrom(json)
  })

export const readBlueprints = (directory: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path

    const files = pipe(
      yield* fs.readDirectory(directory).pipe(Effect.mapError(unreadable)),
      Array.filterMap(file =>
        Result.fromOption(
          Option.map(
            Option.fromNullishOr(BLUEPRINT_FILE.exec(file)?.[1]),
            code => ({ file, set: String.toUpperCase(code) }),
          ),
          () => file,
        ),
      ),
      Array.sort(
        Order.mapInput(Order.String, ({ file }: { file: string }) => file),
      ),
    )

    const texts = yield* Effect.forEach(files, ({ file, set }) =>
      fs.readFileString(path.join(directory, file)).pipe(
        Effect.map((json): BlueprintText => ({ label: file, set, json })),
        Effect.mapError(unreadable),
      ),
    )

    return yield* blueprintsFrom(texts)
  })
