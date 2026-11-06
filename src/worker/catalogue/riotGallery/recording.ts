import { Array, Effect, FileSystem, Order, Path, Schema, String } from 'effect'

export const RECORDING_DIRECTORY = 'catalogue/recordings/riot-gallery'

const decodeJson = Schema.decodeUnknownEffect(
  Schema.fromJsonString(Schema.Unknown),
)

export const readRecording = (directory: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const files = yield* fs.readDirectory(directory)

    return yield* Effect.forEach(
      Array.sort(Array.filter(files, String.endsWith('.json')), Order.String),
      file =>
        fs
          .readFileString(path.join(directory, file))
          .pipe(Effect.flatMap(decodeJson)),
    )
  })
