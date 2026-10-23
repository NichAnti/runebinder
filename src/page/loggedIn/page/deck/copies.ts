import { Array, Option } from 'effect'

import {
  CopyPlan,
  Deck,
  DeckEdit,
  DeckRules,
  type Printing,
} from '../../../../domain'

export type CopyStep =
  | Readonly<{
      _tag: 'Edits'
      edits: Array.NonEmptyReadonlyArray<DeckEdit.DeckEdit>
    }>
  | Readonly<{ _tag: 'LoadCard' }>

const cardsOf = (
  printingIds: ReadonlyArray<Printing.PrintingId>,
  cards: ReadonlyArray<Deck.DeckCard>,
): ReadonlyArray<Deck.DeckCard> =>
  Array.filter(cards, ({ printingId }) =>
    Array.contains(printingIds, printingId),
  )

export const copiesIn = (
  contents: Deck.DeckContents,
  zone: Deck.Zone,
  printingIds: ReadonlyArray<Printing.PrintingId>,
): number =>
  Deck.copiesIn(cardsOf(printingIds, DeckEdit.cardsIn(contents, zone)))

const mostCopies = (
  contents: Deck.DeckContents,
  zone: Deck.Zone,
  printingIds: ReadonlyArray<Printing.PrintingId>,
): Option.Option<Printing.PrintingId> =>
  Option.map(
    Array.reduce(
      cardsOf(printingIds, DeckEdit.cardsIn(contents, zone)),
      Option.none<Deck.DeckCard>(),
      (most, card) =>
        Option.exists(most, ({ copies }) => copies >= card.copies)
          ? most
          : Option.some(card),
    ),
    ({ printingId }) => printingId,
  )

const step = (
  zone: Deck.Zone,
  printingId: Printing.PrintingId,
  by: DeckEdit.Step,
): DeckEdit.DeckEdit => ({ _tag: 'StepCopies', zone, printingId, step: by })

const targetOf = (zone: Deck.Zone): CopyPlan.Target => {
  if (zone === 'Main') {
    return 'Main'
  } else if (zone === 'Sideboard') {
    return 'Sideboard'
  } else {
    return 'Other'
  }
}

const added = (
  contents: Deck.DeckContents,
  zone: Deck.Zone,
  printingIds: ReadonlyArray<Printing.PrintingId>,
): CopyStep =>
  Option.match(
    Option.orElse(mostCopies(contents, zone, printingIds), () =>
      zone === 'Main' || zone === 'Sideboard'
        ? Option.orElse(mostCopies(contents, 'Main', printingIds), () =>
            mostCopies(contents, 'Sideboard', printingIds),
          )
        : Option.none(),
    ),
    {
      onNone: () => ({ _tag: 'LoadCard' }),
      onSome: printingId => ({
        _tag: 'Edits',
        edits: [step(zone, printingId, 1)],
      }),
    },
  )

const moved = (
  contents: Deck.DeckContents,
  from: Deck.Zone,
  to: Deck.Zone,
  printingIds: ReadonlyArray<Printing.PrintingId>,
): Option.Option<CopyStep> =>
  Option.map(mostCopies(contents, from, printingIds), printingId => ({
    _tag: 'Edits',
    edits: [step(from, printingId, -1), step(to, printingId, 1)],
  }))

export const copyStepOf = (
  contents: Deck.DeckContents,
  zone: Deck.Zone,
  printingIds: ReadonlyArray<Printing.PrintingId>,
  maybeLimit: Option.Option<number>,
  by: DeckEdit.Step,
): Option.Option<CopyStep> => {
  if (by === -1) {
    return Option.map(
      mostCopies(contents, zone, printingIds),
      (printingId): CopyStep => ({
        _tag: 'Edits',
        edits: [step(zone, printingId, -1)],
      }),
    )
  }

  const placement: CopyPlan.Placement = {
    main: copiesIn(contents, 'Main', printingIds),
    sideboard: copiesIn(contents, 'Sideboard', printingIds),
    champion: Option.exists(contents.maybeChosenChampion, printingId =>
      Array.contains(printingIds, printingId),
    )
      ? 1
      : 0,
    other: copiesIn(contents, zone, printingIds),
  }

  return Option.flatMap(
    CopyPlan.additionTo(
      targetOf(zone),
      placement,
      maybeLimit,
      DeckRules.MAX_SIDEBOARD - Deck.copiesIn(contents.sideboard),
    ),
    addition => {
      if (addition === 'Add') {
        return Option.some(added(contents, zone, printingIds))
      } else if (addition === 'MoveFromMain') {
        return moved(contents, 'Main', 'Sideboard', printingIds)
      } else {
        return moved(contents, 'Sideboard', 'Main', printingIds)
      }
    },
  )
}
