import { Array, Number, Option, Order, pipe } from 'effect'

import type { DeckCard } from './deck'
import type { DeckEdit } from './deckEdit'
import { RUNE_DECK_SIZE } from './deckRules'
import type { Domain, PrintingId } from './printing'

export type RuneChoice = Readonly<{ domain: Domain; printingId: PrintingId }>

const byCopiesDescending = Order.flip(
  Order.mapInput(Order.Number, ({ copies }: DeckCard) => copies),
)

export const targetsOf = (count: number): ReadonlyArray<number> =>
  Array.makeBy(count, index =>
    index === 0
      ? Math.floor(RUNE_DECK_SIZE / count) + (RUNE_DECK_SIZE % count)
      : Math.floor(RUNE_DECK_SIZE / count),
  )

const stepsFor = (
  runes: ReadonlyArray<DeckCard>,
  choice: RuneChoice,
  target: number,
  domainOf: (printingId: PrintingId) => Option.Option<Domain>,
): ReadonlyArray<DeckEdit> => {
  const ofDomain = pipe(
    Array.filter(runes, ({ printingId }) =>
      Option.exists(domainOf(printingId), domain => domain === choice.domain),
    ),
    Array.sort(byCopiesDescending),
  )
  const delta =
    target - Number.sumAll(Array.map(ofDomain, ({ copies }) => copies))

  if (delta > 0) {
    const printingId = Option.match(Array.head(ofDomain), {
      onNone: () => choice.printingId,
      onSome: ({ printingId }) => printingId,
    })

    return Array.makeBy(delta, () => ({
      _tag: 'StepCopies',
      zone: 'Runes',
      printingId,
      step: 1,
    }))
  } else {
    const removals = Array.flatMap(ofDomain, ({ printingId, copies }) =>
      Array.makeBy(copies, () => printingId),
    )

    return Array.map(Array.take(removals, -delta), (printingId): DeckEdit => ({
      _tag: 'StepCopies',
      zone: 'Runes',
      printingId,
      step: -1,
    }))
  }
}

export const splitEvenly = (
  runes: ReadonlyArray<DeckCard>,
  choices: ReadonlyArray<RuneChoice>,
  domainOf: (printingId: PrintingId) => Option.Option<Domain>,
): ReadonlyArray<DeckEdit> =>
  Array.flatten(
    Array.zipWith(choices, targetsOf(Array.length(choices)), (choice, target) =>
      stepsFor(runes, choice, target, domainOf),
    ),
  )
