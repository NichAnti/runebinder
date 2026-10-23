import { Match } from 'effect'

import { DeckRules, type Printing } from '../../../../domain'

const PART_LABELS: Readonly<Record<DeckRules.RulePart, string>> = {
  ChosenChampion: 'chosen champion',
  Main: 'main deck',
  Runes: 'rune deck',
  Battlefields: 'battlefields',
  Sideboard: 'sideboard',
}

type Explained = Readonly<{ text: string; reference: string }>

export const explain = (
  problem: DeckRules.RuleProblem,
  nameFor: (cardId: Printing.CardId) => string,
): Explained =>
  Match.value(problem).pipe(
    Match.withReturnType<Explained>(),
    Match.tagsExhaustive({
      NoLegend: () => ({
        text: 'Choose a legend.',
        reference: 'Core Rules 103.2',
      }),
      MainDeckTooSmall: ({ size }) => ({
        text: `The main deck has ${size} cards, including the chosen champion. It needs at least ${DeckRules.MAIN_DECK_MINIMUM}.`,
        reference: 'Core Rules 103.3',
      }),
      MainDeckNotForty: ({ size }) => ({
        text: `The main deck has ${size} cards. Tournaments need exactly ${DeckRules.CONSTRUCTED_MAIN_DECK_SIZE}.`,
        reference: 'Tournament Rules 402.1',
      }),
      NoChosenChampion: () => ({
        text: 'Choose a chosen champion from the main deck.',
        reference: 'Core Rules 103.3.a',
      }),
      ChampionNotChampionUnit: ({ cardId }) => ({
        text: `${nameFor(cardId)} is not a champion unit, so it cannot be the chosen champion.`,
        reference: 'Core Rules 103.3.a.2',
      }),
      ChampionTagMismatch: ({ cardId }) => ({
        text: `${nameFor(cardId)} does not share a champion tag with the legend.`,
        reference: 'Core Rules 103.3.a.2',
      }),
      TooManyCopies: ({ cardId, copies, isCountingSideboard }) =>
        isCountingSideboard
          ? {
              text: `${nameFor(cardId)} has ${copies} copies across the main deck and sideboard. Tournaments allow ${DeckRules.MAX_COPIES_OF_A_NAME} in total.`,
              reference: 'Tournament Rules 601.1.c.3',
            }
          : {
              text: `${nameFor(cardId)} has ${copies} copies, including the chosen champion. A deck can have ${DeckRules.MAX_COPIES_OF_A_NAME}.`,
              reference: 'Core Rules 103.3.b',
            },
      OutsideDomainIdentity: ({ cardId, part }) => ({
        text: `${nameFor(cardId)} in the ${PART_LABELS[part]} has a domain the legend does not have.`,
        reference: 'Core Rules 103.2.b',
      }),
      TooManySignatureCards: ({ count }) => ({
        text: `The deck has ${count} signature cards. It can have ${DeckRules.MAX_SIGNATURE_CARDS} in total.`,
        reference: 'Core Rules 103.3.d.1',
      }),
      SignatureTagMismatch: ({ cardId }) => ({
        text: `${nameFor(cardId)} is a signature card of another champion.`,
        reference: 'Core Rules 103.3.d.2',
      }),
      RuneDeckNotTwelve: ({ size }) => ({
        text: `The rune deck has ${size} runes. It needs exactly ${DeckRules.RUNE_DECK_SIZE}.`,
        reference: 'Core Rules 103.4.a',
      }),
      BattlefieldsNotThree: ({ count }) => ({
        text: `The deck has ${count} battlefields. Tournaments need exactly ${DeckRules.CONSTRUCTED_BATTLEFIELDS}.`,
        reference: 'Tournament Rules 402.1',
      }),
      DuplicateBattlefield: ({ cardId }) => ({
        text: `${nameFor(cardId)} is in the battlefields more than once.`,
        reference: 'Core Rules 103.5.c',
      }),
      SideboardTooLarge: ({ size }) => ({
        text: `The sideboard has ${size} cards. Tournaments allow ${DeckRules.MAX_SIDEBOARD} or fewer.`,
        reference: 'Tournament Rules 601.1.c.1',
      }),
      AdditionalLegendsCount: ({ required, count }) => ({
        text: `The deck asks for ${required} additional legends and has ${count}.`,
        reference: 'Core Rules 103.1',
      }),
      DuplicateAdditionalLegend: ({ cardId }) => ({
        text: `${nameFor(cardId)} is chosen as a legend more than once.`,
        reference: 'Core Rules 103.1',
      }),
    }),
  )
