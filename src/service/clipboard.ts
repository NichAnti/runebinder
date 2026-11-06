import { Effect, Schema } from 'effect'

export class ClipboardError extends Schema.TaggedError<ClipboardError>()(
  'ClipboardError',
  {},
) {}

export const writeText = (text: string): Effect.Effect<void, ClipboardError> =>
  Effect.tryPromise({
    try: () => navigator.clipboard.writeText(text),
    catch: () => new ClipboardError(),
  })
