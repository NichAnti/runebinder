import { Effect, FileSystem, Layer, Path, Result } from 'effect'

import {
  CatalogueSource,
  RejectedRecords,
  UnreadableRecording,
} from '../source'
import { printingsFromPages } from './fromPages'
import { RECORDING_DIRECTORY, readRecording } from './recording'

export const RecordedRiotGallery = Layer.effect(
  CatalogueSource,
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path

    return CatalogueSource.of({
      name: 'RiotGallery',
      printings: readRecording(RECORDING_DIRECTORY).pipe(
        Effect.provideService(FileSystem.FileSystem, fs),
        Effect.provideService(Path.Path, path),
        Effect.mapError(
          error => new UnreadableRecording({ message: String(error) }),
        ),
        Effect.flatMap(pages =>
          Result.match(printingsFromPages(pages), {
            onSuccess: Effect.succeed,
            onFailure: issues => Effect.fail(new RejectedRecords({ issues })),
          }),
        ),
      ),
    })
  }),
)
