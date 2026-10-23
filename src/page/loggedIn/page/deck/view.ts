import { Array, Match, Number, Option, Record, String, pipe } from 'effect'
import { Submodel } from 'foldkit'
import type { Html, HtmlBuilder } from 'foldkit/html'

import {
  type CatalogueSearch,
  Deck,
  DeckEdit,
  DeckRules,
  type DeckStructure,
  Missing,
  Printing,
  Runes,
  Wishlist,
} from '../../../../domain'
import { deckWishlistRouter, decksRouter } from '../../../../route'
import {
  Button,
  CardTile,
  Checkbox,
  ColumnChart,
  Link,
  Notice,
  ProgressChip,
  QuantityStepper,
  SearchField,
  SegmentedControl,
  TextField,
  Toast,
} from '../../../../ui'
import * as CardPanel from '../../cardPanel'
import * as CollectionState from '../../collection'
import * as DecksState from '../../decks'
import * as Printings from '../../printings'
import { problemText } from '../deckList/view'
import {
  CURVE_TOP,
  type Line,
  type TypeGroup,
  cardsByPrinting,
  energyCurveOf,
  groupsOf,
  isChampionUnit,
  linesOf,
  nameOf,
  quantitiesOf,
} from './lines'
import { Message } from './message'
import { type AddTab, type Layout, type Model, sectionElementId } from './model'
import { explain } from './problemText'

export type ViewInputs = Readonly<{
  decks: DecksState.Model
  deckId: Deck.DeckId
  collection: CollectionState.Model
}>

type Context = Readonly<{
  model: Model
  deck: Deck.Deck
  collection: CollectionState.Model
  byPrinting: ReadonlyMap<string, Printing.Card>
  problems: Option.Option<ReadonlyArray<DeckRules.RuleProblem>>
  maybeLegend: Option.Option<Printing.Printing>
  additionalLegendsAsked: number
}>

const SECTION_LABELS: Readonly<Record<DeckRules.Section, string>> = {
  Legend: 'Legend',
  ChosenChampion: 'Chosen champion',
  Main: 'Main deck',
  Runes: 'Runes',
  Battlefields: 'Battlefields',
  Sideboard: 'Sideboard',
  AdditionalLegends: 'Additional legends',
}

const TAB_LABELS: Readonly<Record<AddTab, string>> = {
  Legend: 'Legends',
  Champion: 'Champions',
  Unit: 'Units',
  Spell: 'Spells',
  Gear: 'Gear',
  Rune: 'Runes',
  Battlefield: 'Battlefields',
  AdditionalLegend: 'Additional legends',
}

const TARGETS: Readonly<Partial<Record<DeckRules.Section, string>>> = {
  Main: `/${DeckRules.CONSTRUCTED_MAIN_DECK_SIZE}`,
  Runes: `/${DeckRules.RUNE_DECK_SIZE}`,
  Battlefields: `/${DeckRules.CONSTRUCTED_BATTLEFIELDS}`,
  Sideboard: `/${DeckRules.MAX_SIDEBOARD}`,
}

// HELPERS

const printingFinder =
  (byPrinting: ReadonlyMap<string, Printing.Card>) =>
  (printingId: Printing.PrintingId): Option.Option<Printing.Printing> =>
    Option.flatMap(Option.fromNullishOr(byPrinting.get(printingId)), card =>
      Array.findFirst(card.printings, ({ id }) => id === printingId),
    )

const nameFinder =
  (byPrinting: ReadonlyMap<string, Printing.Card>) =>
  (cardId: Printing.CardId): string =>
    Option.match(
      Array.findFirst(
        Array.fromIterable(byPrinting.values()),
        card => card.id === cardId,
      ),
      { onNone: () => cardId, onSome: nameOf },
    )

const problemsIn = (
  context: Context,
  section: DeckRules.Section,
): ReadonlyArray<DeckRules.RuleProblem> =>
  Option.match(context.problems, {
    onNone: () => [],
    onSome: Array.filter(problem => DeckRules.sectionOf(problem) === section),
  })

const smallButton = (
  content: string,
  onClick: Message,
  h: HtmlBuilder<Message>,
): Html => Button.view({ content: [content], variant: 'Secondary', onClick }, h)

const tileOf = (
  card: Printing.Card,
  printingId: Printing.PrintingId,
  maybeHighlight: Option.Option<string>,
): CardTile.ViewConfig => {
  const printing = Option.getOrElse(
    Array.findFirst(card.printings, ({ id }) => id === printingId),
    () => Printing.basePrinting(card),
  )

  return {
    imageUrl: printing.imageUrl,
    imageAlt: Option.getOrElse(
      printing.maybeAccessibilityText,
      () => printing.name,
    ),
    title: printing.name,
    maybeSubtitle: printing.maybeSubtitle,
    domains: printing.domains,
    meta: Option.getOrElse(printing.maybeType, () => ''),
    highlights: Option.toArray(maybeHighlight),
  }
}

const panelView = (
  context: Context,
  place: DeckStructure.Place,
  card: Printing.Card,
  trigger: CardPanel.Trigger,
  quantities: Readonly<Record<string, number>>,
  max: number,
  h: HtmlBuilder<Message>,
): Html =>
  h.submodel({
    slotId: `deck-${place}-${card.id}`,
    model: context.model.panels[place],
    view: CardPanel.tileView,
    viewInputs: {
      cardId: card.id,
      label: nameOf(card),
      trigger,
      counts: Printings.Counts.Ready({ kind: 'InDeck', quantities, max }),
    },
    toParentMessage: message =>
      Message.GotCardPanelMessage({ panelId: place, message }),
  })

// SECTIONS

const sectionHeader = (
  context: Context,
  section: DeckRules.Section,
  maybeCount: Option.Option<number>,
  h: HtmlBuilder<Message>,
): Html => {
  const problems = problemsIn(context, section)
  const status = Option.match(context.problems, {
    onNone: () => '',
    onSome: () => (Array.isReadonlyArrayEmpty(problems) ? ' ✓' : ' ⚠'),
  })

  return h.div(
    [h.Class('flex flex-col gap-1')],
    [
      h.h2(
        [h.Class('flex items-baseline gap-2 text-base font-semibold')],
        [
          SECTION_LABELS[section],
          ...Option.match(maybeCount, {
            onNone: () => [],
            onSome: count => [
              h.span(
                [h.Class('text-sm font-normal tabular-nums text-fg-muted')],
                [`${count}${TARGETS[section] ?? ''}${status}`],
              ),
            ],
          }),
        ],
      ),
      ...Array.map(problems, problem =>
        h.p(
          [h.Class('text-sm text-danger')],
          [explain(problem, nameFinder(context.byPrinting)).text],
        ),
      ),
    ],
  )
}

const lineStepper = (
  zone: Deck.Zone,
  line: Line,
  h: HtmlBuilder<Message>,
): Html => {
  const primary = Array.reduce(
    line.cards,
    Array.headNonEmpty(line.cards),
    (most, card) => (card.copies > most.copies ? card : most),
  )

  return QuantityStepper.view(
    {
      label: `Copies: ${line.label}`,
      quantity: line.copies,
      max: Deck.MAX_COPIES,
      onDecrement: Message.ClickedStepLine({
        zone,
        printingId: primary.printingId,
        step: -1,
      }),
      onIncrement: Message.ClickedStepLine({
        zone,
        printingId: primary.printingId,
        step: 1,
      }),
    },
    h,
  )
}

const lineActions = (
  zone: Deck.Zone,
  line: Line,
  h: HtmlBuilder<Message>,
): ReadonlyArray<Html> => {
  const printingIds = Array.map(line.cards, ({ printingId }) => printingId)

  return Match.value(zone).pipe(
    Match.withReturnType<ReadonlyArray<Html>>(),
    Match.when('Main', () => [
      ...(Option.exists(line.maybeCard, isChampionUnit)
        ? [
            smallButton(
              'Make champion',
              Message.ClickedMakeChampion({
                printingId: Array.headNonEmpty(line.cards).printingId,
              }),
              h,
            ),
          ]
        : []),
      smallButton(
        'To sideboard',
        Message.ClickedMoveLine({ from: 'Main', to: 'Sideboard', printingIds }),
        h,
      ),
    ]),
    Match.when('Sideboard', () => [
      smallButton(
        'To main',
        Message.ClickedMoveLine({ from: 'Sideboard', to: 'Main', printingIds }),
        h,
      ),
    ]),
    Match.orElse(() => []),
  )
}

const quantitiesIn = (line: Line): Readonly<Record<string, number>> =>
  Record.fromEntries(
    Array.map(line.cards, ({ printingId, copies }) => [printingId, copies]),
  )

const gridLineView = (
  context: Context,
  zone: Deck.Zone,
  line: Line,
  h: HtmlBuilder<Message>,
): Html =>
  h.keyed('li')(
    line.key,
    [h.Class('flex flex-col gap-2')],
    [
      Option.match(line.maybeCard, {
        onNone: () => h.span([h.Class('text-sm')], [line.label]),
        onSome: card =>
          panelView(
            context,
            zone,
            card,
            {
              _tag: 'Tile',
              tile: tileOf(
                card,
                Array.headNonEmpty(line.cards).printingId,
                Option.some(`×${line.copies}`),
              ),
            },
            quantitiesIn(line),
            Deck.MAX_COPIES,
            h,
          ),
      }),
      lineStepper(zone, line, h),
      ...Array.match(lineActions(zone, line, h), {
        onEmpty: () => [],
        onNonEmpty: actions => [
          h.div([h.Class('flex flex-wrap gap-1')], actions),
        ],
      }),
    ],
  )

const listLineView = (
  context: Context,
  zone: Deck.Zone,
  line: Line,
  h: HtmlBuilder<Message>,
): Html =>
  h.keyed('li')(
    line.key,
    [h.Class('flex flex-wrap items-center justify-between gap-2')],
    [
      h.div(
        [h.Class('min-w-0 flex-1')],
        [
          Option.match(line.maybeCard, {
            onNone: () => h.span([h.Class('text-sm')], [line.label]),
            onSome: card =>
              panelView(
                context,
                zone,
                card,
                { _tag: 'Line', content: [`${line.copies}× ${line.label}`] },
                quantitiesIn(line),
                Deck.MAX_COPIES,
                h,
              ),
          }),
        ],
      ),
      lineStepper(zone, line, h),
      ...lineActions(zone, line, h),
    ],
  )

const zoneView = (
  context: Context,
  zone: Deck.Zone,
  cards: ReadonlyArray<Deck.DeckCard>,
  h: HtmlBuilder<Message>,
): Html =>
  h.section(
    [
      h.Id(sectionElementId(zone)),
      h.AriaLabel(SECTION_LABELS[zone]),
      h.Class('flex scroll-mt-16 flex-col gap-3'),
    ],
    [
      sectionHeader(
        context,
        zone,
        Option.some(
          zone === 'Main'
            ? Deck.mainDeckSize(context.deck.contents)
            : Deck.copiesIn(cards),
        ),
        h,
      ),
      ...(zone === 'Runes' ? [splitRunesView(context, h)] : []),
      Array.match(linesOf(cards, context.byPrinting), {
        onEmpty: () =>
          h.p([h.Class('text-sm text-fg-muted')], ['Nothing here yet.']),
        onNonEmpty: lines =>
          zone === 'Main'
            ? mainLinesView(context, lines, h)
            : linesView(context, zone, lines, h),
      }),
    ],
  )

const splitRunesView = (context: Context, h: HtmlBuilder<Message>): Html =>
  Option.match(context.maybeLegend, {
    onNone: () => h.empty,
    onSome: legend =>
      Array.match(legend.domains, {
        onEmpty: () => h.empty,
        onNonEmpty: domains =>
          h.div(
            [h.Class('flex flex-wrap items-center gap-2')],
            [
              smallButton(
                `Split evenly: ${Array.join(
                  Array.zipWith(
                    domains,
                    Runes.targetsOf(Array.length(domains)),
                    (domain, target) => `${target} ${domain}`,
                  ),
                  ' · ',
                )}`,
                Message.ClickedSplitRunes(),
                h,
              ),
            ],
          ),
      }),
  })

const linesView = (
  context: Context,
  zone: Deck.Zone,
  lines: ReadonlyArray<Line>,
  h: HtmlBuilder<Message>,
): Html =>
  context.model.layout === 'Grid'
    ? h.ul(
        [h.Class('grid grid-cols-3 gap-3 sm:grid-cols-4 xl:grid-cols-5')],
        Array.map(lines, line => gridLineView(context, zone, line, h)),
      )
    : h.ul(
        [h.Class('flex flex-col gap-2')],
        Array.map(lines, line => listLineView(context, zone, line, h)),
      )

const GROUP_LABELS: Readonly<Record<TypeGroup, string>> = {
  Unit: 'Units',
  Spell: 'Spells',
  Gear: 'Gear',
  Other: 'Other',
}

const curveLabel = (energy: number): string =>
  energy === CURVE_TOP ? `${CURVE_TOP}+` : `${energy}`

const curveView = (
  context: Context,
  lines: ReadonlyArray<Line>,
  h: HtmlBuilder<Message>,
): Html => {
  const championLines = linesOf(
    Array.map(
      Option.toArray(context.deck.contents.maybeChosenChampion),
      printingId => ({ printingId, copies: Deck.Copies.make(1) }),
    ),
    context.byPrinting,
  )

  return ColumnChart.view(
    {
      title: 'Energy curve',
      columns: Array.map(
        energyCurveOf([...championLines, ...lines]),
        (copies, energy) => ({
          label: curveLabel(energy),
          value: copies,
          description: `${curveLabel(energy)} energy: ${copies === 1 ? '1 card' : `${copies} cards`}`,
        }),
      ),
    },
    h,
  )
}

const mainLinesView = (
  context: Context,
  lines: ReadonlyArray<Line>,
  h: HtmlBuilder<Message>,
): Html =>
  h.div(
    [h.Class('flex flex-col gap-5')],
    [
      curveView(context, lines, h),
      ...Array.map(groupsOf(lines), ({ group, lines: groupLines }) =>
        h.div(
          [
            h.AriaLabel(GROUP_LABELS[group]),
            h.Role('group'),
            h.Class('flex flex-col gap-2'),
          ],
          [
            h.h3(
              [h.Class('flex items-baseline gap-2 text-sm font-semibold')],
              [
                GROUP_LABELS[group],
                h.span(
                  [h.Class('font-normal tabular-nums text-fg-muted')],
                  [
                    `${Number.sumAll(Array.map(groupLines, ({ copies }) => copies))}`,
                  ],
                ),
              ],
            ),
            linesView(context, 'Main', groupLines, h),
          ],
        ),
      ),
    ],
  )

const slotView = (
  context: Context,
  place: 'Legend' | 'ChosenChampion',
  maybePrintingId: Option.Option<Printing.PrintingId>,
  chooseTab: AddTab,
  onClear: Message,
  h: HtmlBuilder<Message>,
): Html =>
  h.section(
    [
      h.Id(sectionElementId(place)),
      h.AriaLabel(SECTION_LABELS[place]),
      h.Class('flex scroll-mt-16 flex-col gap-2'),
    ],
    [
      sectionHeader(context, place, Option.none(), h),
      Option.match(
        Option.flatMap(maybePrintingId, printingId =>
          Option.map(
            Option.fromNullishOr(context.byPrinting.get(printingId)),
            card => ({ card, printingId }),
          ),
        ),
        {
          onNone: () =>
            h.div(
              [
                h.Class(
                  'flex aspect-[744/1039] w-40 flex-col items-center justify-center gap-2 rounded-card border border-dashed border-border p-3 text-center text-sm text-fg-muted',
                ),
              ],
              [
                place === 'Legend' ? 'No legend yet' : 'No champion yet',
                Button.view(
                  {
                    content: [
                      place === 'Legend' ? 'Choose legend' : 'Choose champion',
                    ],
                    onClick: Message.SelectedAddTab({ tab: chooseTab }),
                  },
                  h,
                ),
              ],
            ),
          onSome: ({ card, printingId }) =>
            h.div(
              [h.Class('flex w-40 flex-col gap-2')],
              [
                panelView(
                  context,
                  place,
                  card,
                  {
                    _tag: 'Tile',
                    tile: tileOf(card, printingId, Option.none()),
                  },
                  { [printingId]: 1 },
                  1,
                  h,
                ),
                h.div(
                  [h.Class('flex gap-2')],
                  [
                    smallButton(
                      'Change',
                      Message.SelectedAddTab({ tab: chooseTab }),
                      h,
                    ),
                    smallButton('Remove', onClear, h),
                  ],
                ),
              ],
            ),
        },
      ),
    ],
  )

const additionalLegendsView = (
  context: Context,
  h: HtmlBuilder<Message>,
): Html => {
  const legends = context.deck.contents.additionalLegends

  return context.additionalLegendsAsked === 0 &&
    Array.isReadonlyArrayEmpty(legends)
    ? h.empty
    : h.section(
        [
          h.Id(sectionElementId('AdditionalLegends')),
          h.AriaLabel(SECTION_LABELS.AdditionalLegends),
          h.Class('flex scroll-mt-16 flex-col gap-2'),
        ],
        [
          sectionHeader(
            context,
            'AdditionalLegends',
            Option.some(Array.length(legends)),
            h,
          ),
          h.ul(
            [h.Class('flex flex-col gap-1')],
            Array.map(legends, (printingId, position) =>
              h.keyed('li')(
                printingId,
                [h.Class('flex items-center justify-between gap-2')],
                [
                  Option.match(
                    Option.fromNullishOr(context.byPrinting.get(printingId)),
                    {
                      onNone: () => h.span([h.Class('text-sm')], [printingId]),
                      onSome: card =>
                        panelView(
                          context,
                          'AdditionalLegends',
                          card,
                          { _tag: 'Line', content: [nameOf(card)] },
                          quantitiesOf(legends),
                          Deck.MAX_COPIES,
                          h,
                        ),
                    },
                  ),
                  smallButton(
                    'Remove',
                    Message.ClickedRemoveAdditionalLegend({ position }),
                    h,
                  ),
                ],
              ),
            ),
          ),
          smallButton(
            'Add an additional legend',
            Message.SelectedAddTab({ tab: 'AdditionalLegend' }),
            h,
          ),
        ],
      )
}

// ADD CARDS

const BASE_TABS: ReadonlyArray<AddTab> = [
  'Legend',
  'Champion',
  'Unit',
  'Spell',
  'Gear',
  'Rune',
  'Battlefield',
]

const tabsFor = (context: Context): ReadonlyArray<AddTab> =>
  context.additionalLegendsAsked > 0
    ? Array.append(BASE_TABS, 'AdditionalLegend')
    : BASE_TABS

const isLegal = (
  maybeLegend: Option.Option<Printing.Printing>,
  card: CatalogueSearch.CardSummary,
): boolean =>
  Option.match(maybeLegend, {
    onNone: () => true,
    onSome: legend =>
      Array.every(
        Array.filter(card.domains, domain => domain !== 'Colorless'),
        domain => Array.contains(legend.domains, domain),
      ),
  })

const inDeckText = (
  tab: AddTab,
  contents: Deck.DeckContents,
  card: CatalogueSearch.CardSummary,
): Option.Option<string> => {
  const has = (printingId: Printing.PrintingId) =>
    Array.contains(card.printingIds, printingId)
  const copiesIn = (cards: ReadonlyArray<Deck.DeckCard>) =>
    Deck.copiesIn(Array.filter(cards, ({ printingId }) => has(printingId)))

  const text = Match.value(tab).pipe(
    Match.withReturnType<Option.Option<string>>(),
    Match.when('Legend', () =>
      Option.exists(contents.maybeLegend, has)
        ? Option.some('Legend')
        : Option.none(),
    ),
    Match.when('Champion', () =>
      Option.exists(contents.maybeChosenChampion, has)
        ? Option.some('Chosen')
        : Option.none(),
    ),
    Match.when('AdditionalLegend', () =>
      Array.some(contents.additionalLegends, has)
        ? Option.some('Added')
        : Option.none(),
    ),
    Match.when('Rune', () =>
      pipe(copiesIn(contents.runes), count =>
        count === 0 ? Option.none() : Option.some(`×${count} in deck`),
      ),
    ),
    Match.when('Battlefield', () =>
      pipe(copiesIn(contents.battlefields), count =>
        count === 0 ? Option.none() : Option.some(`×${count} in deck`),
      ),
    ),
    Match.orElse(() =>
      pipe(
        copiesIn(contents.main) +
          (Option.exists(contents.maybeChosenChampion, has) ? 1 : 0),
        count =>
          count === 0 ? Option.none() : Option.some(`×${count} in deck`),
      ),
    ),
  )

  return text
}

const zoneOfTab = (tab: AddTab): Deck.Zone => {
  if (tab === 'Rune') {
    return 'Runes'
  } else if (tab === 'Battlefield') {
    return 'Battlefields'
  } else {
    return 'Main'
  }
}

const cardsOf = (
  card: CatalogueSearch.CardSummary,
  zoneCards: ReadonlyArray<Deck.DeckCard>,
): ReadonlyArray<Deck.DeckCard> =>
  Array.filter(zoneCards, ({ printingId }) =>
    Array.contains(card.printingIds, printingId),
  )

const resultStepper = (
  context: Context,
  card: CatalogueSearch.CardSummary,
  label: string,
  h: HtmlBuilder<Message>,
): Html => {
  const { contents } = context.deck
  const zone = zoneOfTab(context.model.addTab)
  const inZone = cardsOf(card, DeckEdit.cardsIn(contents, zone))
  const copies = Deck.copiesIn(inZone)
  const used =
    zone === 'Main'
      ? copies +
        Deck.copiesIn(cardsOf(card, contents.sideboard)) +
        (Option.exists(contents.maybeChosenChampion, printingId =>
          Array.contains(card.printingIds, printingId),
        )
          ? 1
          : 0)
      : copies
  const mostCopies = Array.reduce(
    inZone,
    Option.none<Deck.DeckCard>(),
    (most, deckCard) =>
      Option.exists(most, ({ copies }) => copies >= deckCard.copies)
        ? most
        : Option.some(deckCard),
  )

  return QuantityStepper.view(
    {
      label: `In ${SECTION_LABELS[zone]}: ${label}`,
      quantity: copies,
      max: Option.match(card.maybeCopyLimit, {
        onNone: () => Deck.MAX_COPIES,
        onSome: limit => copies + Number.max(0, limit - used),
      }),
      onDecrement: Message.ClickedStepLine({
        zone,
        printingId: Option.match(mostCopies, {
          onNone: () => Array.headNonEmpty(card.printingIds),
          onSome: ({ printingId }) => printingId,
        }),
        step: -1,
      }),
      onIncrement: Message.ClickedAddCard({ cardId: card.id }),
    },
    h,
  )
}

const resultView = (
  context: Context,
  card: CatalogueSearch.CardSummary,
  h: HtmlBuilder<Message>,
): Html => {
  const tab = context.model.addTab
  const label = Option.match(card.maybeSubtitle, {
    onNone: () => card.name,
    onSome: subtitle => `${card.name}, ${subtitle}`,
  })
  const isChoice =
    tab === 'Legend' || tab === 'Champion' || tab === 'AdditionalLegend'

  return h.keyed('li')(
    card.id,
    [h.Class('flex flex-col items-center gap-2')],
    [
      CardTile.view(
        {
          imageUrl: card.imageUrl,
          imageAlt: Option.getOrElse(
            card.maybeAccessibilityText,
            () => card.name,
          ),
          title: card.name,
          maybeSubtitle: card.maybeSubtitle,
          domains: card.domains,
          meta: '',
          highlights: isChoice
            ? Option.toArray(inDeckText(tab, context.deck.contents, card))
            : [],
        },
        h,
      ),
      isChoice
        ? Button.view(
            {
              content: [
                tab === 'AdditionalLegend' ? `Add ${label}` : `Choose ${label}`,
              ],
              variant: 'Secondary',
              onClick: Message.ClickedAddCard({ cardId: card.id }),
            },
            h,
          )
        : resultStepper(context, card, label, h),
    ],
  )
}

const addPanelView = (context: Context, h: HtmlBuilder<Message>): Html => {
  const { model } = context
  const results =
    model.isOnlyLegal && model.addTab !== 'Legend'
      ? Array.filter(model.searchResults, card =>
          isLegal(context.maybeLegend, card),
        )
      : model.searchResults

  return h.aside(
    [
      h.AriaLabel('Add cards'),
      h.Class(
        'flex flex-col gap-3 rounded-card border border-border bg-surface p-4 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto',
      ),
    ],
    [
      h.h2([h.Class('text-base font-semibold')], ['Add cards']),
      SegmentedControl.view(
        {
          label: 'Card type',
          choices: Array.map(tabsFor(context), tab => ({
            value: tab,
            label: TAB_LABELS[tab],
          })),
          selected: model.addTab,
          onSelect: tab => Message.SelectedAddTab({ tab }),
        },
        h,
      ),
      SearchField.view(
        {
          id: 'deck-add-search',
          label: `Search ${TAB_LABELS[model.addTab]}`,
          value: model.searchText,
          placeholder: `Search ${String.toLowerCase(TAB_LABELS[model.addTab])}…`,
          onInput: value => Message.UpdatedSearch({ value }),
        },
        h,
      ),
      Checkbox.view(
        {
          id: 'deck-only-legal',
          label: 'Only cards this legend allows',
          isChecked: model.isOnlyLegal,
          onToggle: isChecked => Message.ToggledOnlyLegal({ isChecked }),
        },
        h,
      ),
      Array.match(results, {
        onEmpty: () =>
          h.p([h.Class('text-sm text-fg-muted')], ['No cards found.']),
        onNonEmpty: nonEmpty =>
          h.ul(
            [
              h.AriaLabel('Cards to add'),
              h.Class('grid grid-cols-2 gap-3 sm:grid-cols-3'),
            ],
            Array.map(nonEmpty, card => resultView(context, card, h)),
          ),
      }),
    ],
  )
}

// HEADER

type Part = Readonly<{
  section: DeckRules.Section
  label: string
  value: string
}>

const slotValue = (maybePrintingId: Option.Option<Printing.PrintingId>) =>
  Option.isSome(maybePrintingId) ? 'chosen' : 'to choose'

const partsOf = (context: Context): ReadonlyArray<Part> => {
  const { contents } = context.deck
  const additional: ReadonlyArray<Part> =
    context.additionalLegendsAsked > 0
      ? [
          {
            section: 'AdditionalLegends',
            label: 'Additional legends',
            value: `${Array.length(contents.additionalLegends)}/${context.additionalLegendsAsked}`,
          },
        ]
      : []

  return [
    {
      section: 'Legend',
      label: 'Legend',
      value: slotValue(contents.maybeLegend),
    },
    {
      section: 'ChosenChampion',
      label: 'Champion',
      value: slotValue(contents.maybeChosenChampion),
    },
    {
      section: 'Main',
      label: 'Main',
      value: `${Deck.mainDeckSize(contents)}/${DeckRules.CONSTRUCTED_MAIN_DECK_SIZE}`,
    },
    {
      section: 'Runes',
      label: 'Runes',
      value: `${Deck.copiesIn(contents.runes)}/${DeckRules.RUNE_DECK_SIZE}`,
    },
    {
      section: 'Battlefields',
      label: 'Battlefields',
      value: `${Deck.copiesIn(contents.battlefields)}/${DeckRules.CONSTRUCTED_BATTLEFIELDS}`,
    },
    {
      section: 'Sideboard',
      label: 'Sideboard',
      value: `${Deck.copiesIn(contents.sideboard)}/${DeckRules.MAX_SIDEBOARD}`,
    },
    ...additional,
  ]
}

const statusOf = (
  context: Context,
  section: DeckRules.Section,
): ProgressChip.Status =>
  Option.match(context.problems, {
    onNone: () => 'Unfinished',
    onSome: () => DeckRules.progressOf(problemsIn(context, section)),
  })

const rulesText = (context: Context): string =>
  Option.match(context.problems, {
    onNone: () => 'Checking the rules…',
    onSome: problems =>
      Array.match(problems, {
        onEmpty: () => 'Follows the official deckbuilding rules',
        onNonEmpty: nonEmpty =>
          Array.every(nonEmpty, DeckRules.isUnfinished)
            ? 'Not finished yet'
            : 'Breaks a deckbuilding rule: see the marked parts',
      }),
  })

const progressView = (context: Context, h: HtmlBuilder<Message>): Html =>
  h.nav(
    [
      h.AriaLabel('Deck progress'),
      h.Class(
        'sticky top-0 z-10 -mx-4 flex flex-wrap items-center gap-2 border-b border-border bg-canvas px-4 py-2',
      ),
    ],
    [
      ...Array.map(partsOf(context), ({ section, label, value }) =>
        ProgressChip.view(
          {
            label,
            value,
            status: statusOf(context, section),
            onClick: Message.ClickedProgress({ section }),
          },
          h,
        ),
      ),
      h.p(
        [h.Role('status'), h.Class('ml-auto text-sm text-fg-muted')],
        [rulesText(context)],
      ),
    ],
  )

const exportView = (model: Model, h: HtmlBuilder<Message>): Html =>
  Match.value(model.export).pipe(
    Match.withReturnType<Html>(),
    Match.tagsExhaustive({
      Idle: () => h.empty,
      Copied: ({ code }) =>
        h.p(
          [h.Role('status'), h.Class('break-all text-sm text-fg-muted')],
          [`Copied: ${code}`],
        ),
      CopyFailed: ({ code }) =>
        h.p(
          [h.Role('status'), h.Class('break-all text-sm text-fg-muted')],
          [`Copy it by hand: ${code}`],
        ),
      NotEncodable: ({ problem }) =>
        h.p(
          [h.Role('alert'), h.Class('text-sm text-danger')],
          [problemText(problem)],
        ),
    }),
  )

const headerView = (context: Context, h: HtmlBuilder<Message>): Html =>
  h.header(
    [h.Class('flex flex-col gap-3')],
    [
      Link.view({ href: decksRouter(), content: ['← Decks'] }, h),
      h.div(
        [h.Class('flex flex-wrap items-end justify-between gap-3')],
        [
          h.div(
            [h.Class('min-w-64 flex-1')],
            [
              TextField.view(
                {
                  id: 'deck-name',
                  label: 'Deck name',
                  field: context.model.name,
                  onInput: value => Message.UpdatedName({ value }),
                },
                h,
              ),
            ],
          ),
          h.div(
            [h.Class('flex items-center gap-3')],
            [
              SegmentedControl.view(
                {
                  label: 'Show cards as',
                  choices: [
                    { value: 'Grid', label: 'Grid' },
                    { value: 'List', label: 'List' },
                  ] satisfies ReadonlyArray<SegmentedControl.Choice<Layout>>,
                  selected: context.model.layout,
                  onSelect: layout => Message.SelectedLayout({ layout }),
                },
                h,
              ),
              Button.view(
                {
                  content: ['Copy deck code'],
                  onClick: Message.ClickedCopyCode(),
                },
                h,
              ),
            ],
          ),
        ],
      ),
      missingView(context, h),
      exportView(context.model, h),
    ],
  )

const missingView = (context: Context, h: HtmlBuilder<Message>): Html =>
  Option.match(CollectionState.maybeOwned(context.collection), {
    onNone: () => h.empty,
    onSome: owned => {
      const missing = Number.sumAll(
        Array.map(
          Wishlist.linesOf(Missing.needs([context.deck], owned), {}),
          ({ quantity }) => quantity,
        ),
      )

      return h.div(
        [h.Class('flex flex-wrap items-center gap-3')],
        [
          h.span(
            [h.Class('text-sm text-fg-muted tabular-nums')],
            [
              missing === 0
                ? 'You own every card in this deck.'
                : `${missing} copies missing from your collection.`,
            ],
          ),
          ...(missing === 0
            ? []
            : [
                Link.view(
                  {
                    href: deckWishlistRouter({ deckId: context.deck.id }),
                    content: ['Open its wishlist'],
                  },
                  h,
                ),
              ]),
        ],
      )
    },
  })

const deleteView = (
  model: Model,
  removal: Option.Option<DecksState.Removal>,
  h: HtmlBuilder<Message>,
): Html =>
  h.section(
    [
      h.AriaLabel('Delete deck'),
      h.Class('flex flex-wrap items-center gap-3 border-t border-border pt-6'),
    ],
    [
      ...(model.isConfirmingDelete
        ? [
            h.span(
              [h.Class('text-sm text-fg')],
              ['Delete this deck for good?'],
            ),
            smallButton('Delete for good', Message.ClickedConfirmDelete(), h),
            smallButton('Keep it', Message.ClickedCancelDelete(), h),
          ]
        : [smallButton('Delete deck', Message.ClickedDelete(), h)]),
      Option.exists(removal, state => state === 'Failed')
        ? h.p(
            [h.Role('alert'), h.Class('text-sm text-danger')],
            ['The deck could not be deleted. Try again.'],
          )
        : h.empty,
    ],
  )

const deckView = (
  model: Model,
  deck: Deck.Deck,
  removal: Option.Option<DecksState.Removal>,
  { collection }: ViewInputs,
  h: HtmlBuilder<Message>,
): Html => {
  const byPrinting = cardsByPrinting(model.cards)
  const find = printingFinder(byPrinting)
  const rules = DeckRules.check(deck.contents, find)
  const { contents } = deck
  const context: Context = {
    model,
    deck,
    collection,
    byPrinting,
    problems:
      rules._tag === 'Checked' ? Option.some(rules.problems) : Option.none(),
    maybeLegend: Option.flatMap(contents.maybeLegend, find),
    additionalLegendsAsked: Array.reduce(
      [
        ...Option.toArray(contents.maybeChosenChampion),
        ...Array.map(contents.main, ({ printingId }) => printingId),
      ],
      0,
      (most, printingId) =>
        Number.max(
          most,
          Option.match(find(printingId), {
            onNone: () => 0,
            onSome: DeckRules.additionalLegendsAsked,
          }),
        ),
    ),
  }

  return h.article(
    [h.Class('flex flex-col gap-6')],
    [
      headerView(context, h),
      progressView(context, h),
      h.div(
        [h.Class('grid gap-8 lg:grid-cols-[minmax(0,1fr)_26rem]')],
        [
          h.div(
            [h.Class('flex flex-col gap-8')],
            [
              h.div(
                [h.Class('flex flex-wrap gap-6')],
                [
                  slotView(
                    context,
                    'Legend',
                    contents.maybeLegend,
                    'Legend',
                    Message.ClickedClearLegend(),
                    h,
                  ),
                  slotView(
                    context,
                    'ChosenChampion',
                    contents.maybeChosenChampion,
                    'Champion',
                    Message.ClickedClearChampion(),
                    h,
                  ),
                ],
              ),
              zoneView(context, 'Main', contents.main, h),
              zoneView(context, 'Runes', contents.runes, h),
              zoneView(context, 'Battlefields', contents.battlefields, h),
              zoneView(context, 'Sideboard', contents.sideboard, h),
              additionalLegendsView(context, h),
            ],
          ),
          addPanelView(context, h),
        ],
      ),
      deleteView(model, removal, h),
      Toast.view(
        {
          slotId: 'deck-toast',
          model: model.toast,
          toParentMessage: message => Message.GotToastMessage({ message }),
        },
        h,
      ),
    ],
  )
}

export const view = Submodel.defineView<Model, Message, ViewInputs>(
  (model, inputs, h) =>
    DecksState.Model.match(inputs.decks, {
      NotLoaded: () =>
        Notice.view({ title: 'Loading your decks…', description: [] }, h),
      Loading: () =>
        Notice.view({ title: 'Loading your decks…', description: [] }, h),
      Failed: () =>
        Notice.view(
          {
            title: 'Your decks could not be loaded',
            description: ['Check your connection and try again.'],
            variant: 'Error',
            actions: [
              Button.view(
                {
                  content: ['Try again'],
                  onClick: Message.ClickedRetryLoadDecks(),
                },
                h,
              ),
            ],
          },
          h,
        ),
      Ready: ready =>
        Option.match(
          Array.findFirst(ready.decks, deck => deck.id === inputs.deckId),
          {
            onNone: () =>
              Notice.view(
                {
                  title: 'Deck not found',
                  description: [
                    'There is no deck at this address. ',
                    Link.view(
                      { href: decksRouter(), content: ['Back to your decks'] },
                      h,
                    ),
                  ],
                },
                h,
              ),
            onSome: deck =>
              deckView(
                model,
                deck,
                Record.get(ready.removals, deck.id),
                inputs,
                h,
              ),
          },
        ),
    }),
)
