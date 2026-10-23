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

import { type DeckCard, type DeckContents, copiesIn } from './deck'
import { CardId, type Domain, type Printing, type PrintingId } from './printing'

export const MAIN_DECK_MINIMUM = 40
export const CONSTRUCTED_MAIN_DECK_SIZE = 40
export const RUNE_DECK_SIZE = 12
export const CONSTRUCTED_BATTLEFIELDS = 3
export const MAX_COPIES_OF_A_NAME = 3
export const MAX_SIGNATURE_CARDS = 3
export const MAX_SIDEBOARD = 10

export const RulePart = Schema.Literals([
  'ChosenChampion',
  'Main',
  'Runes',
  'Battlefields',
  'Sideboard',
])
export type RulePart = typeof RulePart.Type

export const RuleProblem = Schema.Union([
  Schema.TaggedStruct('NoLegend', {}),
  Schema.TaggedStruct('MainDeckTooSmall', { size: Schema.Int }),
  Schema.TaggedStruct('MainDeckNotForty', { size: Schema.Int }),
  Schema.TaggedStruct('NoChosenChampion', {}),
  Schema.TaggedStruct('ChampionNotChampionUnit', { cardId: CardId }),
  Schema.TaggedStruct('ChampionTagMismatch', { cardId: CardId }),
  Schema.TaggedStruct('TooManyCopies', {
    cardId: CardId,
    copies: Schema.Int,
    isCountingSideboard: Schema.Boolean,
  }),
  Schema.TaggedStruct('OutsideDomainIdentity', {
    cardId: CardId,
    part: RulePart,
  }),
  Schema.TaggedStruct('TooManySignatureCards', { count: Schema.Int }),
  Schema.TaggedStruct('SignatureTagMismatch', { cardId: CardId }),
  Schema.TaggedStruct('RuneDeckNotTwelve', { size: Schema.Int }),
  Schema.TaggedStruct('BattlefieldsNotThree', { count: Schema.Int }),
  Schema.TaggedStruct('DuplicateBattlefield', { cardId: CardId }),
  Schema.TaggedStruct('SideboardTooLarge', { size: Schema.Int }),
  Schema.TaggedStruct('DuplicateAdditionalLegend', { cardId: CardId }),
])
export type RuleProblem = typeof RuleProblem.Type

export type FindPrinting = (printingId: PrintingId) => Option.Option<Printing>

export type RulesCheck =
  | Readonly<{ _tag: 'Checked'; problems: ReadonlyArray<RuleProblem> }>
  | Readonly<{ _tag: 'MissingCards' }>

type Copy = Readonly<{ printing: Printing; copies: number }>

type Resolved = Readonly<{
  maybeLegend: Option.Option<Printing>
  maybeChampion: Option.Option<Printing>
  main: ReadonlyArray<Copy>
  runes: ReadonlyArray<Copy>
  battlefields: ReadonlyArray<Copy>
  sideboard: ReadonlyArray<Copy>
  additionalLegends: ReadonlyArray<Printing>
  sizes: Readonly<{
    main: number
    runes: number
    battlefields: number
    sideboard: number
  }>
}>

const when = (
  condition: boolean,
  problem: () => RuleProblem,
): ReadonlyArray<RuleProblem> => (condition ? [problem()] : [])

// CARDS

const resolveCards = (
  cards: ReadonlyArray<DeckCard>,
  find: FindPrinting,
): Option.Option<ReadonlyArray<Copy>> =>
  Option.all(
    Array.map(cards, ({ printingId, copies }) =>
      Option.map(find(printingId), printing => ({ printing, copies })),
    ),
  )

const resolveOptional = (
  maybePrintingId: Option.Option<PrintingId>,
  find: FindPrinting,
): Option.Option<Option.Option<Printing>> =>
  Option.match(maybePrintingId, {
    onNone: () => Option.some(Option.none()),
    onSome: printingId => Option.map(find(printingId), Option.some),
  })

const resolve = (
  contents: DeckContents,
  find: FindPrinting,
): Option.Option<Resolved> =>
  Option.map(
    Option.all({
      maybeLegend: resolveOptional(contents.maybeLegend, find),
      maybeChampion: resolveOptional(contents.maybeChosenChampion, find),
      main: resolveCards(contents.main, find),
      runes: resolveCards(contents.runes, find),
      battlefields: resolveCards(contents.battlefields, find),
      sideboard: resolveCards(contents.sideboard, find),
      additionalLegends: Option.all(
        Array.map(contents.additionalLegends, find),
      ),
    }),
    resolved => ({
      ...resolved,
      sizes: {
        main:
          copiesIn(contents.main) +
          (Option.isSome(contents.maybeChosenChampion) ? 1 : 0),
        runes: copiesIn(contents.runes),
        battlefields: copiesIn(contents.battlefields),
        sideboard: copiesIn(contents.sideboard),
      },
    }),
  )

const domainsOf = (printing: Printing): ReadonlyArray<Domain> =>
  Array.filter(printing.domains, domain => domain !== 'Colorless')

const isWithin = (
  identity: ReadonlyArray<Domain>,
  printing: Printing,
): boolean =>
  Array.every(domainsOf(printing), domain => Array.contains(identity, domain))

const sharesTag = (legend: Printing, printing: Printing): boolean =>
  Array.some(printing.tags, tag => Array.contains(legend.tags, tag))

const isSignature = (printing: Printing): boolean =>
  Array.contains(printing.supertypes, 'Signature')

const isChampionUnit = (printing: Printing): boolean =>
  Array.contains(printing.supertypes, 'Champion') &&
  Option.exists(printing.maybeType, type => type === 'Unit')

const allowsAnyNumber = (printing: Printing): boolean =>
  Option.exists(
    printing.maybeText,
    String.includes(
      `Your deck can have any number of cards named ${printing.name}`,
    ),
  )

const byCard = Order.mapInput(
  Order.String,
  ({ printing }: Copy) => printing.cardId,
)

const perCard = (copies: ReadonlyArray<Copy>): ReadonlyArray<Copy> =>
  pipe(
    Array.groupBy(copies, ({ printing }) => printing.cardId),
    Record.values,
    Array.map(group => ({
      printing: Array.headNonEmpty(group).printing,
      copies: Number.sumAll(Array.map(group, ({ copies }) => copies)),
    })),
    Array.sort(byCard),
  )

const championCopy = (resolved: Resolved): ReadonlyArray<Copy> =>
  Array.map(Option.toArray(resolved.maybeChampion), printing => ({
    printing,
    copies: 1,
  }))

// RULES

const sizeRules = ({ sizes }: Resolved): ReadonlyArray<RuleProblem> => [
  ...(sizes.main < MAIN_DECK_MINIMUM
    ? [{ _tag: 'MainDeckTooSmall', size: sizes.main } satisfies RuleProblem]
    : when(sizes.main !== CONSTRUCTED_MAIN_DECK_SIZE, () => ({
        _tag: 'MainDeckNotForty',
        size: sizes.main,
      }))),
  ...when(sizes.runes !== RUNE_DECK_SIZE, () => ({
    _tag: 'RuneDeckNotTwelve',
    size: sizes.runes,
  })),
  ...when(sizes.battlefields !== CONSTRUCTED_BATTLEFIELDS, () => ({
    _tag: 'BattlefieldsNotThree',
    count: sizes.battlefields,
  })),
  ...when(sizes.sideboard > MAX_SIDEBOARD, () => ({
    _tag: 'SideboardTooLarge',
    size: sizes.sideboard,
  })),
]

const championRules = (resolved: Resolved): ReadonlyArray<RuleProblem> =>
  Option.match(resolved.maybeChampion, {
    onNone: () => [{ _tag: 'NoChosenChampion' }],
    onSome: champion => [
      ...when(!isChampionUnit(champion), () => ({
        _tag: 'ChampionNotChampionUnit',
        cardId: champion.cardId,
      })),
      ...Option.match(resolved.maybeLegend, {
        onNone: () => [],
        onSome: legend =>
          when(!sharesTag(legend, champion), () => ({
            _tag: 'ChampionTagMismatch',
            cardId: champion.cardId,
          })),
      }),
    ],
  })

const copyRules = (resolved: Resolved): ReadonlyArray<RuleProblem> => {
  const mainCopies = perCard([...championCopy(resolved), ...resolved.main])
  const allCopies = perCard([
    ...championCopy(resolved),
    ...resolved.main,
    ...resolved.sideboard,
  ])

  return Array.filterMap(allCopies, ({ printing, copies }) => {
    const mainCount = Option.match(
      Array.findFirst(
        mainCopies,
        copy => copy.printing.cardId === printing.cardId,
      ),
      { onNone: () => 0, onSome: copy => copy.copies },
    )

    return copies <= MAX_COPIES_OF_A_NAME || allowsAnyNumber(printing)
      ? Result.failVoid
      : Result.succeed<RuleProblem>({
          _tag: 'TooManyCopies',
          cardId: printing.cardId,
          copies,
          isCountingSideboard: mainCount <= MAX_COPIES_OF_A_NAME,
        })
  })
}

const identityRules = (resolved: Resolved): ReadonlyArray<RuleProblem> =>
  Option.match(resolved.maybeLegend, {
    onNone: () => [],
    onSome: legend => {
      const identity = domainsOf(legend)
      const outside = (part: RulePart, copies: ReadonlyArray<Copy>) =>
        Array.filterMap(perCard(copies), ({ printing }) =>
          isWithin(identity, printing)
            ? Result.failVoid
            : Result.succeed<RuleProblem>({
                _tag: 'OutsideDomainIdentity',
                cardId: printing.cardId,
                part,
              }),
        )

      return [
        ...outside('ChosenChampion', championCopy(resolved)),
        ...outside('Main', resolved.main),
        ...outside('Runes', resolved.runes),
        ...outside('Battlefields', resolved.battlefields),
        ...outside('Sideboard', resolved.sideboard),
      ]
    },
  })

const signatureRules = (resolved: Resolved): ReadonlyArray<RuleProblem> => {
  const signatures = Array.filter(resolved.main, ({ printing }) =>
    isSignature(printing),
  )
  const count = Number.sumAll(Array.map(signatures, ({ copies }) => copies))

  return [
    ...when(count > MAX_SIGNATURE_CARDS, () => ({
      _tag: 'TooManySignatureCards',
      count,
    })),
    ...Option.match(resolved.maybeLegend, {
      onNone: () => [],
      onSome: legend =>
        Array.filterMap(perCard(signatures), ({ printing }) =>
          sharesTag(legend, printing)
            ? Result.failVoid
            : Result.succeed<RuleProblem>({
                _tag: 'SignatureTagMismatch',
                cardId: printing.cardId,
              }),
        ),
    }),
  ]
}

const repeated = (printings: ReadonlyArray<Printing>): ReadonlyArray<CardId> =>
  pipe(
    Array.groupBy(printings, ({ cardId }) => cardId),
    Record.toEntries,
    Array.filterMap(([cardId, group]) =>
      Array.length(group) > 1
        ? Result.succeed(CardId.make(cardId))
        : Result.failVoid,
    ),
  )

const uniquenessRules = (resolved: Resolved): ReadonlyArray<RuleProblem> => [
  ...Array.map(
    repeated(
      Array.flatMap(resolved.battlefields, ({ printing, copies }) =>
        Array.replicate(printing, copies),
      ),
    ),
    (cardId): RuleProblem => ({ _tag: 'DuplicateBattlefield', cardId }),
  ),
  ...Array.map(
    repeated([
      ...Option.toArray(resolved.maybeLegend),
      ...resolved.additionalLegends,
    ]),
    (cardId): RuleProblem => ({ _tag: 'DuplicateAdditionalLegend', cardId }),
  ),
]

export const check = (contents: DeckContents, find: FindPrinting): RulesCheck =>
  Option.match(resolve(contents, find), {
    onNone: () => ({ _tag: 'MissingCards' }),
    onSome: resolved => ({
      _tag: 'Checked',
      problems: [
        ...(Option.isNone(resolved.maybeLegend)
          ? [{ _tag: 'NoLegend' } satisfies RuleProblem]
          : []),
        ...championRules(resolved),
        ...sizeRules(resolved),
        ...copyRules(resolved),
        ...identityRules(resolved),
        ...signatureRules(resolved),
        ...uniquenessRules(resolved),
      ],
    }),
  })
