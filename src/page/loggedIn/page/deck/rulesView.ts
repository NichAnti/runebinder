import { Array, Match, Option } from 'effect'
import type { Html, HtmlBuilder } from 'foldkit/html'

import { type Deck, DeckRules, type Printing } from '../../../../domain'
import { Notice } from '../../../../ui'
import { nameOf } from './lines'

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

export const rulesView = <Message>(
  contents: Deck.DeckContents,
  byPrinting: ReadonlyMap<string, Printing.Card>,
  h: HtmlBuilder<Message>,
): Html => {
  const find = (printingId: Printing.PrintingId) =>
    Option.flatMap(Option.fromNullishOr(byPrinting.get(printingId)), card =>
      Array.findFirst(card.printings, ({ id }) => id === printingId),
    )
  const nameFor = (cardId: Printing.CardId) =>
    Option.match(
      Array.findFirst(
        Array.fromIterable(byPrinting.values()),
        card => card.id === cardId,
      ),
      { onNone: () => cardId, onSome: nameOf },
    )
  const result = DeckRules.check(contents, find)

  return h.section(
    [h.AriaLabel('Deck rules'), h.Class('flex flex-col gap-2')],
    [
      h.h2([h.Class('text-base font-semibold')], ['Deck rules']),
      result._tag === 'MissingCards'
        ? h.p(
            [h.Role('status'), h.Class('text-sm text-fg-muted')],
            ['Checking the rules…'],
          )
        : Array.match(result.problems, {
            onEmpty: () =>
              Notice.view(
                {
                  title: 'This deck follows the official deckbuilding rules',
                  description: [
                    'Checked against the Core Rules and the Tournament Rules for constructed play.',
                  ],
                },
                h,
              ),
            onNonEmpty: problems =>
              h.ul(
                [h.Class('flex flex-col gap-2')],
                Array.map(problems, problem => {
                  const { text, reference } = explain(problem, nameFor)

                  return h.keyed('li')(
                    JSON.stringify(problem),
                    [h.Class('flex flex-col text-sm')],
                    [
                      h.span([h.Class('text-fg')], [text]),
                      h.span([h.Class('text-xs text-fg-muted')], [reference]),
                    ],
                  )
                }),
              ),
          }),
    ],
  )
}
