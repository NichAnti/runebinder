import {
  Array,
  Number,
  Option,
  Order,
  Record,
  Result,
  Schema,
  String,
  pipe,
} from 'effect'

import {
  getCodeFromDeck,
  getDeckFromCode,
} from '@piltoverarchive/riftbound-deck-codes'

import { CardCode, cardCodeOf, normalizeCardCode } from './cardCode'
import { Copies, type DeckCard, type DeckContents, MAX_COPIES } from './deck'
import { type CardType, type Printing, PrintingId } from './printing'

export const DeckCode = Schema.String.check(
  Schema.isPattern(/^[A-Z2-7]+$/),
).pipe(Schema.brand('DeckCode'))
export type DeckCode = typeof DeckCode.Type

export const DeckCodeProblem = Schema.Union([
  Schema.TaggedStruct('Unreadable', {}),
  Schema.TaggedStruct('UnknownCard', { cardCode: Schema.String }),
  Schema.TaggedStruct('TooManyCopies', { cardCode: Schema.String }),
  Schema.TaggedStruct('SeveralLegends', {}),
  Schema.TaggedStruct('ChampionNotInMainDeck', { cardCode: Schema.String }),
  Schema.TaggedStruct('NotEncodable', { printingId: PrintingId }),
  Schema.TaggedStruct('RejectedByFormat', {}),
])
export type DeckCodeProblem = typeof DeckCodeProblem.Type

export type KnownPrinting = Readonly<{
  printingId: PrintingId
  maybeType: Option.Option<CardType>
}>

export type CardLookup = (cardCode: CardCode) => Option.Option<KnownPrinting>

export const lookupFrom = (printings: ReadonlyArray<Printing>): CardLookup => {
  const byCode = new Map(
    Array.filterMap(printings, ({ id, maybeType }) =>
      Result.fromOption(
        Option.map(
          cardCodeOf(id),
          (cardCode): readonly [CardCode, KnownPrinting] => [
            cardCode,
            { printingId: id, maybeType },
          ],
        ),
        () => id,
      ),
    ),
  )

  return cardCode => Option.fromNullishOr(byCode.get(cardCode))
}

type CodeCard = Readonly<{ cardCode: string; count: number }>

type ResolvedCard = KnownPrinting & Readonly<{ copies: Copies }>

// CANONICAL FORM

const byPrinting = Order.mapInput(
  Order.String,
  ({ printingId }: DeckCard) => printingId,
)

const merged = (cards: ReadonlyArray<DeckCard>): ReadonlyArray<DeckCard> =>
  pipe(
    Array.groupBy(cards, ({ printingId }) => printingId),
    groups =>
      Array.map(Record.values(groups), group => ({
        printingId: Array.headNonEmpty(group).printingId,
        copies: Copies.make(
          Number.min(
            MAX_COPIES,
            Number.sumAll(Array.map(group, ({ copies }) => copies)),
          ),
        ),
      })),
    Array.sort(byPrinting),
  )

export const canonical = (contents: DeckContents): DeckContents => ({
  ...contents,
  main: merged(contents.main),
  runes: merged(contents.runes),
  battlefields: merged(contents.battlefields),
  sideboard: merged(contents.sideboard),
})

// DECODE

const resolve =
  (lookup: CardLookup) =>
  ({
    cardCode,
    count,
  }: CodeCard): Result.Result<ResolvedCard, DeckCodeProblem> =>
    pipe(
      normalizeCardCode(cardCode),
      Option.flatMap(lookup),
      Result.fromOption((): DeckCodeProblem => ({
        _tag: 'UnknownCard',
        cardCode,
      })),
      Result.flatMap(known =>
        pipe(
          Schema.decodeOption(Copies)(count),
          Result.fromOption((): DeckCodeProblem => ({
            _tag: 'TooManyCopies',
            cardCode,
          })),
          Result.map(copies => ({ ...known, copies })),
        ),
      ),
    )

const resolveAll = (
  lookup: CardLookup,
  cards: ReadonlyArray<CodeCard>,
): Result.Result<ReadonlyArray<ResolvedCard>, DeckCodeProblem> =>
  Result.all(Array.map(cards, resolve(lookup)))

const isType =
  (type: CardType) =>
  ({ maybeType }: ResolvedCard): boolean =>
    Option.exists(maybeType, actual => actual === type)

const toDeckCards = (
  cards: ReadonlyArray<ResolvedCard>,
): ReadonlyArray<DeckCard> =>
  Array.map(cards, ({ printingId, copies }) => ({ printingId, copies }))

const takeLegend = (
  legends: ReadonlyArray<ResolvedCard>,
): Result.Result<Option.Option<PrintingId>, DeckCodeProblem> =>
  Array.match(legends, {
    onEmpty: () => Result.succeed(Option.none()),
    onNonEmpty: ([legend, ...others]) =>
      Array.isReadonlyArrayEmpty(others) && legend.copies === 1
        ? Result.succeed(Option.some(legend.printingId))
        : Result.fail({ _tag: 'SeveralLegends' }),
  })

const withoutOneCopy = (
  cards: ReadonlyArray<DeckCard>,
  printingId: PrintingId,
): ReadonlyArray<DeckCard> =>
  Array.filterMap(cards, card =>
    card.printingId !== printingId
      ? Result.succeed(card)
      : Result.fromOption(
          Option.map(Schema.decodeOption(Copies)(card.copies - 1), copies => ({
            printingId,
            copies,
          })),
          () => card,
        ),
  )

const takeChampion = (
  lookup: CardLookup,
  maybeCode: Option.Option<string>,
  main: ReadonlyArray<DeckCard>,
): Result.Result<
  Readonly<{
    maybeChampion: Option.Option<PrintingId>
    main: ReadonlyArray<DeckCard>
  }>,
  DeckCodeProblem
> =>
  Option.match(maybeCode, {
    onNone: () => Result.succeed({ maybeChampion: Option.none(), main }),
    onSome: cardCode =>
      pipe(
        resolve(lookup)({ cardCode, count: 1 }),
        Result.flatMap(({ printingId }) =>
          Array.some(main, card => card.printingId === printingId)
            ? Result.succeed({
                maybeChampion: Option.some(printingId),
                main: withoutOneCopy(main, printingId),
              })
            : Result.fail<DeckCodeProblem>({
                _tag: 'ChampionNotInMainDeck',
                cardCode,
              }),
        ),
      ),
  })

const readCode = (code: string) =>
  Result.try({
    try: () => getDeckFromCode(String.trim(code)),
    catch: (): DeckCodeProblem => ({ _tag: 'Unreadable' }),
  })

export const decode = (
  code: string,
  lookup: CardLookup,
): Result.Result<DeckContents, DeckCodeProblem> =>
  Result.gen(function* () {
    const raw = yield* readCode(code)
    const mainCards = yield* resolveAll(lookup, raw.mainDeck)
    const sideboard = yield* resolveAll(lookup, raw.sideboard)
    const additionalLegends = yield* resolveAll(
      lookup,
      Array.map(raw.additionalLegends ?? [], cardCode => ({
        cardCode,
        count: 1,
      })),
    )

    const maybeLegend = yield* takeLegend(
      Array.filter(mainCards, isType('Legend')),
    )
    const rest = Array.filter(
      mainCards,
      card =>
        !isType('Legend')(card) &&
        !isType('Rune')(card) &&
        !isType('Battlefield')(card),
    )
    const champion = yield* takeChampion(
      lookup,
      Option.fromNullishOr(raw.chosenChampion),
      toDeckCards(rest),
    )

    return canonical({
      maybeLegend,
      maybeChosenChampion: champion.maybeChampion,
      main: champion.main,
      runes: toDeckCards(Array.filter(mainCards, isType('Rune'))),
      battlefields: toDeckCards(Array.filter(mainCards, isType('Battlefield'))),
      sideboard: toDeckCards(sideboard),
      additionalLegends: Array.map(
        additionalLegends,
        ({ printingId }) => printingId,
      ),
    })
  })

// ENCODE

const codeFor = (
  printingId: PrintingId,
): Result.Result<CardCode, DeckCodeProblem> =>
  Result.fromOption(cardCodeOf(printingId), (): DeckCodeProblem => ({
    _tag: 'NotEncodable',
    printingId,
  }))

const toCodeCards = (
  cards: ReadonlyArray<DeckCard>,
): Result.Result<Array<CodeCard>, DeckCodeProblem> =>
  Result.all(
    Array.map(merged(cards), ({ printingId, copies }) =>
      Result.map(codeFor(printingId), cardCode => ({
        cardCode,
        count: copies,
      })),
    ),
  ).pipe(Result.map(Array.fromIterable))

const oneCopyOf = (maybePrintingId: Option.Option<PrintingId>) =>
  Option.match(maybePrintingId, {
    onNone: (): ReadonlyArray<DeckCard> => [],
    onSome: printingId => [{ printingId, copies: Copies.make(1) }],
  })

export const encode = (
  contents: DeckContents,
): Result.Result<DeckCode, DeckCodeProblem> =>
  Result.gen(function* () {
    const mainDeck = yield* toCodeCards([
      ...oneCopyOf(contents.maybeLegend),
      ...oneCopyOf(contents.maybeChosenChampion),
      ...contents.main,
      ...contents.runes,
      ...contents.battlefields,
    ])
    const sideboard = yield* toCodeCards(contents.sideboard)
    const maybeChampionCode = yield* Option.match(
      contents.maybeChosenChampion,
      {
        onNone: () => Result.succeed(Option.none<CardCode>()),
        onSome: printingId => Result.map(codeFor(printingId), Option.some),
      },
    )
    const additionalLegends = yield* Result.all(
      Array.map(contents.additionalLegends, codeFor),
    )

    const code = yield* Result.try({
      try: () =>
        getCodeFromDeck(
          mainDeck,
          sideboard,
          Option.getOrUndefined(maybeChampionCode),
          Array.isReadonlyArrayNonEmpty(additionalLegends)
            ? Array.fromIterable(additionalLegends)
            : undefined,
        ),
      catch: (): DeckCodeProblem => ({ _tag: 'RejectedByFormat' }),
    })

    return yield* Result.fromOption(
      Schema.decodeOption(DeckCode)(code),
      (): DeckCodeProblem => ({ _tag: 'RejectedByFormat' }),
    )
  })
