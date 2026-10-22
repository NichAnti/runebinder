import { Array, Effect, Option, Result } from 'effect'

import { NodeServices } from '@effect/platform-node'
import { assert, layer } from '@effect/vitest'

import { Printing } from '../../../domain'
import { printingsFromPages } from './fromPages'
import { RECORDING_DIRECTORY, readRecording } from './recording'

const recordedPrintings = readRecording(RECORDING_DIRECTORY).pipe(
  Effect.map(printingsFromPages),
)

const printingWithId = (
  printings: ReadonlyArray<Printing.Printing>,
  id: string,
) => Array.findFirst(printings, printing => printing.id === id)

layer(NodeServices.layer)('the recorded Riot gallery', it => {
  it.effect('every card parses and passes the checks', () =>
    Effect.gen(function* () {
      const result = yield* recordedPrintings
      assert.isTrue(Result.isSuccess(result), JSON.stringify(result))
      assert.strictEqual(Array.length(Result.getOrElse(result, () => [])), 1408)
    }),
  )

  it.effect('variants come from the printed code', () =>
    Effect.gen(function* () {
      const printings = Result.getOrElse(yield* recordedPrintings, () => [])
      const variantOf = (id: string) =>
        Option.map(printingWithId(printings, id), ({ variant }) => variant)

      assert.deepStrictEqual(variantOf('unl-176-219'), Option.some('Base'))
      assert.deepStrictEqual(
        variantOf('unl-176a-219'),
        Option.some('AlternateArt'),
      )
      assert.deepStrictEqual(
        variantOf('unl-226-star-219'),
        Option.some('Signature'),
      )
      assert.deepStrictEqual(
        variantOf('unl-226-219'),
        Option.some('Overnumbered'),
      )
    }),
  )

  it.effect('printings of the same card share a card id', () =>
    Effect.gen(function* () {
      const printings = Result.getOrElse(yield* recordedPrintings, () => [])
      const vi = Array.findFirst(
        Printing.groupByCard(printings),
        card => card.id === 'vi-peacekeeper',
      )

      assert.deepStrictEqual(
        Option.map(vi, card => Array.map(card.printings, ({ id }) => id)),
        Option.some(['unl-176-219', 'unl-176a-219']),
      )
    }),
  )

  it.effect('an unknown field rejects the whole import', () =>
    Effect.gen(function* () {
      const pages = yield* readRecording(RECORDING_DIRECTORY)
      const tampered = Array.map(pages, (page, index) =>
        index === 0
          ? withFirstCard(page, card => ({ ...card, surprise: 1 }))
          : page,
      )
      assert.isTrue(Result.isFailure(printingsFromPages(tampered)))
    }),
  )

  it.effect('a duplicated printing rejects the whole import', () =>
    Effect.gen(function* () {
      const pages = yield* readRecording(RECORDING_DIRECTORY)
      const duplicated = Array.map(pages, (page, index) =>
        index === 0 ? withFirstCard(page, card => card, true) : page,
      )
      assert.isTrue(Result.isFailure(printingsFromPages(duplicated)))
    }),
  )
})

const withFirstCard = (
  page: unknown,
  change: (card: object) => object,
  isDuplicated = false,
): unknown => {
  if (
    typeof page === 'object' &&
    page !== null &&
    'data' in page &&
    globalThis.Array.isArray(page.data)
  ) {
    const [first, ...rest]: ReadonlyArray<object> = page.data
    const changed = change(first ?? {})

    return {
      ...page,
      data: isDuplicated ? [changed, first, ...rest] : [changed, ...rest],
    }
  } else {
    return page
  }
}
