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
import { type Blueprint, BlueprintExport } from './schema'

export const RECORDING_DIRECTORY = 'catalogue/recordings/cardtrader'

const BLUEPRINT_FILE = /^blueprints-([a-z0-9]+)\.json$/

const decodeExport = Schema.decodeUnknownResult(
  Schema.fromJsonString(BlueprintExport),
  { onExcessProperty: 'error' },
)

export const readBlueprints = (directory: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path

    const files = pipe(
      yield* fs.readDirectory(directory),
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

    const decoded = yield* Effect.forEach(files, ({ file, set }, index) =>
      fs.readFileString(path.join(directory, file)).pipe(
        Effect.map(json =>
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
                message: `${file}: ${error.message}`,
              }),
          ),
        ),
      ),
    )

    const [sets, issues] = Array.separate(decoded)

    if (Array.isReadonlyArrayNonEmpty(issues)) {
      return yield* new RejectedRecords({ issues })
    } else {
      return Record.fromEntries(sets)
    }
  }).pipe(
    Effect.catchTag('PlatformError', error =>
      Effect.fail(
        new UnreadableRecording({ message: globalThis.String(error) }),
      ),
    ),
  )
