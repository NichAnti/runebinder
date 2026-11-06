import { Array, Effect, Option, Result } from 'effect'

import { assert, describe, it } from '@effect/vitest'

import { CardText } from '../../domain'
import { HAS_RECORDINGS, recordedPrintings } from './recorded'

describe.skipIf(!HAS_RECORDINGS)('the recorded card data', () => {
  it.effect('every rules and effect text parses', () =>
    Effect.gen(function* () {
      const printings = yield* recordedPrintings

      const failures = Array.filterMap(printings, printing =>
        Array.match(
          Array.getSomes([printing.maybeText, printing.maybeEffect]),
          {
            onEmpty: () => Result.failVoid,
            onNonEmpty: texts =>
              Array.findFirst(texts, html =>
                Result.isFailure(CardText.parse(html)),
              ).pipe(
                Option.match({
                  onNone: () => Result.failVoid,
                  onSome: () => Result.succeed(printing.id),
                }),
              ),
          },
        ),
      )

      assert.deepStrictEqual(failures, [])
    }),
  )
})
