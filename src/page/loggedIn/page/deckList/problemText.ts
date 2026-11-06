import { Match } from 'effect'

import type { DeckCode } from '../../../../domain'

export const problemText = (problem: DeckCode.DeckCodeProblem): string =>
  Match.value(problem).pipe(
    Match.withReturnType<string>(),
    Match.tagsExhaustive({
      Unreadable: () => 'This is not a deck code.',
      UnknownCard: ({ cardCode }) => `${cardCode} is not in the catalogue.`,
      TooManyCopies: ({ cardCode }) => `${cardCode} has too many copies.`,
      SeveralLegends: () =>
        'The code has more than one starting legend, so it cannot tell which one leads the deck.',
      ChampionNotInMainDeck: ({ cardCode }) =>
        `The chosen champion ${cardCode} is not in the main deck.`,
      NotEncodable: ({ printingId }) =>
        `${printingId} cannot be written in a deck code.`,
      RejectedByFormat: () => 'The deck code format rejected this deck.',
    }),
  )
