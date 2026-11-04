import { Array, Match, Number, Option, Record, String, pipe } from 'effect'
import { Submodel } from 'foldkit'
import type { Html, HtmlBuilder } from 'foldkit/html'

import {
  type CatalogueSearch,
  Deck,
  DeckRules,
  type DeckStructure,
  Missing,
  Printing,
  Runes,
  Wishlist,
} from '../../../../domain'
import { deckWishlistRouter, decksRouter } from '../../../../route'
import {
  Badge,
  Button,
  CardTile,
  Checkbox,
  ColumnChart,
  Icon,
  IconButton,
  Link,
  Notice,
  ProgressChip,
  QuantityStepper,
  SearchField,
  SegmentedControl,
  Select,
  Tabs,
  TextField,
  Toast,
} from '../../../../ui'
import * as CardPanel from '../../cardPanel'
import * as CollectionState from '../../collection'
import * as DecksState from '../../decks'
import * as Printings from '../../printings'
import { problemText } from '../deckList/view'
import { copiesIn, copyStepOf, roomIn } from './copies'
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
  versionLinesOf,
} from './lines'
import { Message } from './message'
import {
  type AddTab,
  type Layout,
  type Model,
  SIDE_PANEL_ID,
  SideTabs,
  sectionElementId,
} from './model'
import { explain } from './problemText'

export type ViewInputs = Readonly<{
  decks: DecksState.Model
  deckId: Deck.DeckId
  collection: CollectionState.Model
  maybeWanted: Option.Option<Wishlist.Wanted>
}>

type Context = Readonly<{
  model: Model
  deck: Deck.Deck
  collection: CollectionState.Model
  byPrinting: ReadonlyMap<string, Printing.Card>
  problems: Option.Option<ReadonlyArray<DeckRules.RuleProblem>>
  maybeLegend: Option.Option<Printing.Printing>
  additionalLegendsAsked: number
  maybeWanted: Option.Option<Wishlist.Wanted>
}>

const TILE_GRID = 'grid grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-3'

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
  Main: ` / ${DeckRules.CONSTRUCTED_MAIN_DECK_SIZE}`,
  Runes: ` / ${DeckRules.RUNE_DECK_SIZE}`,
  Battlefields: ` / ${DeckRules.CONSTRUCTED_BATTLEFIELDS}`,
  Sideboard: ` / ${DeckRules.MAX_SIDEBOARD}`,
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

const badgesFor = (
  context: Context,
  printingIds: ReadonlyArray<Printing.PrintingId>,
): ReadonlyArray<string> =>
  Printings.badgesOf(
    CollectionState.maybeOwned(context.collection),
    context.maybeWanted,
    printingIds,
  )

const smallButton = (
  content: string,
  onClick: Message,
  h: HtmlBuilder<Message>,
): Html => Button.view({ content: [content], variant: 'Secondary', onClick }, h)

const tileOf = (
  card: Printing.Card,
  printingId: Printing.PrintingId,
  highlights: ReadonlyArray<string>,
  meta = '',
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
    meta,
    highlights,
  }
}

const panelView = (
  context: Context,
  place: DeckStructure.Place,
  slotKey: string,
  card: Printing.Card,
  trigger: CardPanel.Trigger,
  h: HtmlBuilder<Message>,
): Html =>
  h.submodel({
    slotId: `deck-${place}-${slotKey}`,
    model: context.model.panels[place],
    view: CardPanel.tileView,
    viewInputs: {
      cardId: card.id,
      tileId: `${place}-${slotKey}`,
      label: nameOf(card),
      trigger,
      counts: CollectionState.countsOf(context.collection),
    },
    toParentMessage: message =>
      Message.GotCardPanelMessage({ panelId: place, message }),
  })

// SECTIONS

const statusIconView = (
  context: Context,
  section: DeckRules.Section,
  h: HtmlBuilder<Message>,
): Html =>
  Option.match(context.problems, {
    onNone: () => h.empty,
    onSome: () =>
      Array.isReadonlyArrayEmpty(problemsIn(context, section))
        ? h.span(
            [h.Class('text-success')],
            [Icon.view({ name: 'CheckCircle', size: 'Small' })],
          )
        : h.span(
            [h.Class('text-danger')],
            [Icon.view({ name: 'ExclamationTriangle', size: 'Small' })],
          ),
  })

const problemsView = (
  context: Context,
  sections: ReadonlyArray<DeckRules.Section>,
  h: HtmlBuilder<Message>,
): Html =>
  Array.match(
    Array.flatMap(sections, section => problemsIn(context, section)),
    {
      onEmpty: () => h.empty,
      onNonEmpty: problems =>
        h.ul(
          [
            h.Role('alert'),
            h.Class(
              'flex flex-col gap-1 rounded-control border border-danger bg-surface px-3 py-2 text-sm text-danger',
            ),
          ],
          Array.map(problems, problem => {
            const text = explain(problem, nameFinder(context.byPrinting)).text

            return h.keyed('li')(
              text,
              [h.Class('flex items-start gap-2')],
              [Icon.view({ name: 'ExclamationTriangle', size: 'Small' }), text],
            )
          }),
        ),
    },
  )

const sectionHeader = (
  context: Context,
  section: DeckRules.Section,
  maybeCount: Option.Option<number>,
  h: HtmlBuilder<Message>,
): Html =>
  h.div(
    [h.Class('flex flex-col gap-2')],
    [
      h.div(
        [h.Class('flex items-center justify-between gap-3')],
        [
          h.h2([h.Class('text-lg font-semibold')], [SECTION_LABELS[section]]),
          h.span(
            [
              h.Class(
                'flex items-center gap-1.5 text-sm tabular-nums text-fg-muted',
              ),
            ],
            [
              ...Option.match(maybeCount, {
                onNone: () => [],
                onSome: count => [`${count}${TARGETS[section] ?? ''}`],
              }),
              statusIconView(context, section, h),
            ],
          ),
        ],
      ),
      problemsView(context, [section], h),
    ],
  )

const ZONE_SHORT_LABELS: Readonly<Record<Deck.Zone, string>> = {
  Main: 'Main',
  Sideboard: 'Side',
  Runes: 'Runes',
  Battlefields: 'Fields',
}

const countersView = (
  context: Context,
  cardId: Printing.CardId,
  printingIds: ReadonlyArray<Printing.PrintingId>,
  maybeLimit: Option.Option<number>,
  maybeVersion: Option.Option<Printing.PrintingId>,
  zone: Deck.Zone,
  label: string,
  h: HtmlBuilder<Message>,
): Html => {
  const { contents } = context.deck
  const zones: ReadonlyArray<Deck.Zone> =
    zone === 'Main' || zone === 'Sideboard' ? ['Main', 'Sideboard'] : [zone]
  const counted = Option.match(maybeVersion, {
    onNone: () => printingIds,
    onSome: version => [version],
  })
  const counter = (countedZone: Deck.Zone) => {
    const copies = copiesIn(contents, countedZone, counted)
    const canAdd = Option.isSome(
      copyStepOf(
        contents,
        countedZone,
        printingIds,
        maybeLimit,
        1,
        maybeVersion,
      ),
    )

    return h.div(
      [h.Class('flex w-full items-center justify-between gap-2')],
      [
        h.span(
          [h.AriaHidden(true), h.Class('text-xs text-fg-muted')],
          [ZONE_SHORT_LABELS[countedZone]],
        ),
        QuantityStepper.view(
          {
            size: 'Small',
            label: `In ${SECTION_LABELS[countedZone]}: ${label}`,
            quantity: copies,
            max: canAdd ? copies + 1 : copies,
            onDecrement: Message.ClickedStepCopies({
              cardId,
              maybeVersion,
              zone: countedZone,
              step: -1,
            }),
            onIncrement: Message.ClickedStepCopies({
              cardId,
              maybeVersion,
              zone: countedZone,
              step: 1,
            }),
          },
          h,
        ),
      ],
    )
  }

  return h.div(
    [h.Class('flex w-full flex-col gap-1')],
    Array.map(zones, counter),
  )
}

const lineStepper = (
  context: Context,
  zone: Deck.Zone,
  line: Line,
  h: HtmlBuilder<Message>,
): Html =>
  Option.match(line.maybeCard, {
    onNone: () => {
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
    },
    onSome: card =>
      countersView(
        context,
        card.id,
        Array.map(card.printings, ({ id }) => id),
        DeckRules.copyLimitOf(Printing.basePrinting(card)),
        Option.some(Array.headNonEmpty(line.cards).printingId),
        zone,
        line.label,
        h,
      ),
  })

const SHORT_VARIANT_LABELS: Readonly<Record<Printing.Variant, string>> = {
  Base: 'Standard',
  AlternateArt: 'Alt art',
  Signature: 'Signed',
  Overnumbered: 'Overnumbered',
}

const shortVersionLabel = (printing: Printing.Printing): string =>
  `${SHORT_VARIANT_LABELS[printing.variant]} · ${String.replace(/\/\d+$/, '')(printing.publicCode)}`

const versionPickerView = (
  card: Printing.Card,
  printingId: Printing.PrintingId,
  id: string,
  onChange: (value: string) => Message,
  h: HtmlBuilder<Message>,
): Html =>
  Array.length(card.printings) > 1
    ? Select.view(
        {
          id,
          label: 'Version',
          value: printingId,
          options: Array.map(card.printings, printing => ({
            value: printing.id,
            label: shortVersionLabel(printing),
          })),
          onChange,
          variant: 'Compact',
        },
        h,
      )
    : h.empty

const lineVersionView = (
  zone: Deck.Zone,
  line: Line,
  h: HtmlBuilder<Message>,
): Html =>
  Option.match(line.maybeCard, {
    onNone: () => h.empty,
    onSome: card => {
      const from = Array.headNonEmpty(line.cards).printingId

      return versionPickerView(
        card,
        from,
        `version-${zone}-${from}`,
        value => Message.SelectedVersion({ zone, from, value }),
        h,
      )
    },
  })

const championButton = (
  zone: Deck.Zone,
  line: Line,
  h: HtmlBuilder<Message>,
): Html =>
  zone === 'Main' && Option.exists(line.maybeCard, isChampionUnit)
    ? IconButton.view(
        {
          icon: 'Star',
          label: `Make ${line.label} the chosen champion`,
          size: 'Small',
          action: {
            _tag: 'Click',
            message: Message.ClickedMakeChampion({
              printingId: Array.headNonEmpty(line.cards).printingId,
            }),
          },
        },
        h,
      )
    : h.empty

const versionCaption = (
  card: Printing.Card,
  printingId: Printing.PrintingId,
  h: HtmlBuilder<Message>,
): Html =>
  h.span(
    [h.Class('min-w-0 flex-1 truncate text-xs text-fg-muted')],
    [
      Option.match(
        Array.findFirst(card.printings, ({ id }) => id === printingId),
        { onNone: () => '', onSome: shortVersionLabel },
      ),
    ],
  )

const versionRow = (
  zone: Deck.Zone,
  line: Line,
  h: HtmlBuilder<Message>,
): Html =>
  h.div(
    [h.Class('flex h-7 items-center gap-1')],
    [
      Option.match(line.maybeCard, {
        onNone: () => h.empty,
        onSome: card => {
          const from = Array.headNonEmpty(line.cards).printingId

          return Array.length(card.printings) > 1
            ? h.div(
                [h.Class('min-w-0 flex-1')],
                [lineVersionView(zone, line, h)],
              )
            : versionCaption(card, from, h)
        },
      }),
      championButton(zone, line, h),
    ],
  )

const gridLineView = (
  context: Context,
  zone: Deck.Zone,
  line: Line,
  h: HtmlBuilder<Message>,
): Html =>
  h.keyed('li')(
    line.key,
    [h.Class('flex min-w-0 flex-col gap-2')],
    [
      Option.match(line.maybeCard, {
        onNone: () => h.span([h.Class('text-sm')], [line.label]),
        onSome: card =>
          panelView(
            context,
            zone,
            line.key,
            card,
            {
              _tag: 'Tile',
              tile: tileOf(
                card,
                Array.headNonEmpty(line.cards).printingId,
                badgesFor(
                  context,
                  Array.map(line.cards, ({ printingId }) => printingId),
                ),
              ),
            },
            h,
          ),
      }),
      versionRow(zone, line, h),
      lineStepper(context, zone, line, h),
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
        [h.Class('flex min-w-0 flex-1 items-center gap-2')],
        [
          Option.match(line.maybeCard, {
            onNone: () => h.span([h.Class('text-sm')], [line.label]),
            onSome: card =>
              panelView(
                context,
                zone,
                line.key,
                card,
                {
                  _tag: 'Line',
                  content: [line.label],
                },
                h,
              ),
          }),
          ...Array.map(
            badgesFor(
              context,
              Array.map(line.cards, ({ printingId }) => printingId),
            ),
            text => Badge.view({ content: [text], tone: 'Accent' }, h),
          ),
        ],
      ),
      lineVersionView(zone, line, h),
      lineStepper(context, zone, line, h),
      championButton(zone, line, h),
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
      h.Class(
        'flex scroll-mt-20 flex-col gap-4 border-t border-border pt-6 first:border-t-0 first:pt-0',
      ),
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
      Array.match(versionLinesOf(cards, context.byPrinting), {
        onEmpty: () =>
          linesView(context, zone, [], placeholderView(context, zone, h), h),
        onNonEmpty: lines =>
          zone === 'Main'
            ? mainLinesView(context, lines, h)
            : linesView(
                context,
                zone,
                lines,
                placeholderView(context, zone, h),
                h,
              ),
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

const PLACEHOLDER_TABS: Readonly<Record<Deck.Zone, ReadonlyArray<AddTab>>> = {
  Main: ['Unit', 'Spell', 'Gear'],
  Sideboard: ['Unit', 'Spell', 'Gear'],
  Runes: ['Rune'],
  Battlefields: ['Battlefield'],
}

const hasRoom = (context: Context, zone: Deck.Zone): boolean =>
  roomIn(context.deck.contents, zone) > 0

const placeholderView = (
  context: Context,
  zone: Deck.Zone,
  h: HtmlBuilder<Message>,
): ReadonlyArray<Html> =>
  hasRoom(context, zone)
    ? [
        h.keyed('li')(
          `add-${zone}`,
          [
            h.Class(
              context.model.layout === 'Grid'
                ? 'flex aspect-[744/1039] flex-col items-center justify-center gap-2 rounded-card border border-dashed border-border p-3 text-center text-sm text-fg-muted'
                : 'flex flex-wrap items-center gap-2 rounded-card border border-dashed border-border p-2 text-sm text-fg-muted',
            ),
          ],
          [
            h.span([], [`Add to ${SECTION_LABELS[zone]}`]),
            h.div(
              [h.Class('flex flex-wrap justify-center gap-1')],
              Array.map(PLACEHOLDER_TABS[zone], tab =>
                smallButton(
                  TAB_LABELS[tab],
                  Message.SelectedAddTab({ tab }),
                  h,
                ),
              ),
            ),
          ],
        ),
      ]
    : []

const linesView = (
  context: Context,
  zone: Deck.Zone,
  lines: ReadonlyArray<Line>,
  extra: ReadonlyArray<Html>,
  h: HtmlBuilder<Message>,
): Html =>
  context.model.layout === 'Grid'
    ? h.ul(
        [h.Class(TILE_GRID)],
        [
          ...Array.map(lines, line => gridLineView(context, zone, line, h)),
          ...extra,
        ],
      )
    : h.ul(
        [h.Class('flex flex-col gap-2')],
        [
          ...Array.map(lines, line => listLineView(context, zone, line, h)),
          ...extra,
        ],
      )

const GROUP_LABELS: Readonly<Record<TypeGroup, string>> = {
  Unit: 'Units',
  Spell: 'Spells',
  Gear: 'Gear',
  Other: 'Other',
}

const curveLabel = (energy: number): string =>
  energy === CURVE_TOP ? `${CURVE_TOP}+` : `${energy}`

const curveView = (lines: ReadonlyArray<Line>, h: HtmlBuilder<Message>): Html =>
  ColumnChart.view(
    {
      title: 'Energy curve',
      columns: Array.map(energyCurveOf(lines), (copies, energy) => ({
        label: curveLabel(energy),
        value: copies,
        description: `${curveLabel(energy)} energy: ${copies === 1 ? '1 card' : `${copies} cards`}`,
      })),
    },
    h,
  )

const mainLinesView = (
  context: Context,
  lines: ReadonlyArray<Line>,
  h: HtmlBuilder<Message>,
): Html => {
  const groups = groupsOf(lines)
  const maybeLastGroup = Array.last(groups)

  return h.div(
    [h.Class('flex flex-col gap-6')],
    Array.map(groups, ({ group, lines: groupLines }) =>
      h.div(
        [
          h.AriaLabel(GROUP_LABELS[group]),
          h.Role('group'),
          h.Class('flex flex-col gap-2'),
        ],
        [
          h.h3(
            [
              h.Class(
                'flex items-baseline gap-2 text-xs font-semibold tracking-wide text-fg-muted uppercase',
              ),
            ],
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
          linesView(
            context,
            'Main',
            groupLines,
            Option.exists(maybeLastGroup, last => last.group === group)
              ? placeholderView(context, 'Main', h)
              : [],
            h,
          ),
        ],
      ),
    ),
  )
}

const identitySlotView = (
  context: Context,
  place: 'Legend' | 'ChosenChampion',
  maybePrintingId: Option.Option<Printing.PrintingId>,
  chooseTab: AddTab,
  onClear: Message,
  h: HtmlBuilder<Message>,
): Html => {
  const noun = place === 'Legend' ? 'legend' : 'champion'

  return h.div(
    [
      h.Id(sectionElementId(place)),
      h.AriaLabel(SECTION_LABELS[place]),
      h.Role('group'),
      h.Class('flex w-28 shrink-0 scroll-mt-20 flex-col gap-1.5'),
    ],
    [
      h.span(
        [
          h.Class(
            'flex items-center justify-between text-xs font-medium text-fg-muted',
          ),
        ],
        [SECTION_LABELS[place], statusIconView(context, place, h)],
      ),
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
                  'flex aspect-[744/1039] w-full flex-col items-center justify-center gap-2 rounded-card border border-dashed border-border p-2 text-center text-xs text-fg-muted',
                ),
              ],
              [
                `No ${noun} yet`,
                smallButton(
                  'Choose',
                  Message.SelectedAddTab({ tab: chooseTab }),
                  h,
                ),
              ],
            ),
          onSome: ({ card, printingId }) =>
            h.div(
              [h.Class('flex flex-col gap-1.5')],
              [
                panelView(
                  context,
                  place,
                  printingId,
                  card,
                  {
                    _tag: 'Tile',
                    tile: tileOf(
                      card,
                      printingId,
                      badgesFor(context, [printingId]),
                    ),
                  },
                  h,
                ),
                h.div(
                  [h.Class('flex h-7 items-center gap-1')],
                  [
                    Array.length(card.printings) > 1
                      ? h.div(
                          [h.Class('min-w-0 flex-1')],
                          [
                            versionPickerView(
                              card,
                              printingId,
                              `version-${place}`,
                              value =>
                                Message.SelectedSlotVersion({ place, value }),
                              h,
                            ),
                          ],
                        )
                      : versionCaption(card, printingId, h),
                    IconButton.view(
                      {
                        icon: 'ArrowPath',
                        label: `Change ${noun}`,
                        size: 'Small',
                        action: {
                          _tag: 'Click',
                          message: Message.SelectedAddTab({ tab: chooseTab }),
                        },
                      },
                      h,
                    ),
                    IconButton.view(
                      {
                        icon: 'Trash',
                        label: `Remove ${noun}`,
                        size: 'Small',
                        variant: 'Danger',
                        action: { _tag: 'Click', message: onClear },
                      },
                      h,
                    ),
                  ],
                ),
              ],
            ),
        },
      ),
    ],
  )
}

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
          h.Class('flex scroll-mt-20 flex-col gap-2'),
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
                          printingId,
                          card,
                          { _tag: 'Line', content: [nameOf(card)] },
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
    [h.Class('flex min-w-0 flex-col gap-2')],
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
          highlights: [
            ...(isChoice
              ? Option.toArray(inDeckText(tab, context.deck.contents, card))
              : []),
            ...badgesFor(context, card.printingIds),
          ],
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
              onClick: Message.ClickedAddCard({
                cardId: card.id,
                target: 'Deck',
              }),
            },
            h,
          )
        : countersView(
            context,
            card.id,
            card.printingIds,
            card.maybeCopyLimit,
            Option.none(),
            zoneOfTab(tab),
            label,
            h,
          ),
    ],
  )
}

const addCardsView = (
  context: Context,
  h: HtmlBuilder<Message>,
): ReadonlyArray<Html> => {
  const { model } = context
  const results =
    model.isOnlyLegal && model.addTab !== 'Legend'
      ? Array.filter(model.searchResults, card =>
          isLegal(context.maybeLegend, card),
        )
      : model.searchResults

  return [
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
          [h.AriaLabel('Cards to add'), h.Class(TILE_GRID)],
          Array.map(nonEmpty, card => resultView(context, card, h)),
        ),
    }),
  ]
}

// STATS

const mainAndChampionLines = (context: Context): ReadonlyArray<Line> =>
  linesOf(
    [
      ...Array.map(
        Option.toArray(context.deck.contents.maybeChosenChampion),
        printingId => ({ printingId, copies: Deck.Copies.make(1) }),
      ),
      ...context.deck.contents.main,
    ],
    context.byPrinting,
  )

const statListView = (
  label: string,
  entries: ReadonlyArray<readonly [string, number]>,
  h: HtmlBuilder<Message>,
): Html =>
  h.div(
    [h.Class('flex flex-col gap-1')],
    [
      h.h3([h.Class('text-xs font-medium text-fg-muted')], [label]),
      h.dl(
        [h.AriaLabel(label), h.Class('flex flex-wrap gap-x-5 gap-y-1')],
        Array.map(entries, ([name, value]) =>
          h.keyed('div')(
            name,
            [h.Class('flex items-baseline gap-1.5')],
            [
              h.dt([h.Class('text-sm text-fg')], [name]),
              h.dd(
                [h.Class('text-sm font-semibold tabular-nums')],
                [`${value}`],
              ),
            ],
          ),
        ),
      ),
    ],
  )

const domainsOf = (line: Line): ReadonlyArray<Printing.Domain> =>
  Option.match(line.maybeCard, {
    onNone: () => [],
    onSome: card => Printing.basePrinting(card).domains,
  })

const statsView = (
  context: Context,
  h: HtmlBuilder<Message>,
): ReadonlyArray<Html> => {
  const lines = mainAndChampionLines(context)
  const copiesWhere = (predicate: (line: Line) => boolean) =>
    Number.sumAll(
      Array.map(Array.filter(lines, predicate), ({ copies }) => copies),
    )

  return Array.match(lines, {
    onEmpty: () => [
      h.p(
        [h.Class('text-sm text-fg-muted')],
        ['Add cards to the main deck to see its statistics.'],
      ),
      missingView(context, h),
    ],
    onNonEmpty: nonEmpty => [
      curveView(nonEmpty, h),
      statListView(
        'Card types',
        Array.map(
          groupsOf(nonEmpty),
          ({ group, lines: groupLines }): readonly [string, number] => [
            GROUP_LABELS[group],
            Number.sumAll(Array.map(groupLines, ({ copies }) => copies)),
          ],
        ),
        h,
      ),
      statListView(
        'Domains',
        Array.filter(
          Array.map(
            Printing.Domain.literals,
            (domain): readonly [string, number] => [
              domain,
              copiesWhere(line => Array.contains(domainsOf(line), domain)),
            ],
          ),
          ([, copies]) => copies > 0,
        ),
        h,
      ),
      missingView(context, h),
    ],
  })
}

// SIDE PANEL

const sidePanelView = (context: Context, h: HtmlBuilder<Message>): Html =>
  h.aside(
    [
      h.Id(SIDE_PANEL_ID),
      h.AriaLabel('Deck tools'),
      h.Class(
        'flex scroll-mt-20 flex-col gap-3 rounded-card border border-border bg-surface p-4 lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto',
      ),
    ],
    [
      Tabs.view(
        {
          bundle: SideTabs,
          slotId: 'deck-side',
          model: context.model.sideTabs,
          toParentMessage: message => Message.GotSideTabsMessage({ message }),
          ariaLabel: 'Deck tools',
          tabs: [
            { value: 'Stats', label: 'Deck stats' },
            { value: 'Add', label: 'Add cards' },
          ],
          selected: context.model.sidePanel,
          panel: panel =>
            panel === 'Stats'
              ? statsView(context, h)
              : addCardsView(context, h),
        },
        h,
      ),
    ],
  )

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
        'sticky top-0 z-10 -mx-4 flex items-center gap-2 overflow-x-auto border-b border-border bg-canvas px-4 py-2 lg:flex-wrap',
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
        [
          h.Role('status'),
          h.Class('ml-auto shrink-0 whitespace-nowrap text-sm text-fg-muted'),
        ],
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

const headerView = (context: Context, h: HtmlBuilder<Message>): Html => {
  const { contents } = context.deck

  return h.header(
    [h.Class('flex flex-col gap-4')],
    [
      Link.view({ href: decksRouter(), content: ['← Decks'] }, h),
      h.div(
        [h.Class('flex flex-wrap items-start gap-4')],
        [
          identitySlotView(
            context,
            'Legend',
            contents.maybeLegend,
            'Legend',
            Message.ClickedClearLegend(),
            h,
          ),
          identitySlotView(
            context,
            'ChosenChampion',
            contents.maybeChosenChampion,
            'Champion',
            Message.ClickedClearChampion(),
            h,
          ),
          h.div(
            [h.Class('flex min-w-64 flex-1 flex-col gap-3')],
            [
              h.div(
                [h.Class('flex items-start justify-between gap-3')],
                [
                  h.div(
                    [h.Class('min-w-0 flex-1')],
                    [
                      TextField.view(
                        {
                          id: 'deck-name',
                          label: 'Deck name',
                          field: context.model.name,
                          onInput: value => Message.UpdatedName({ value }),
                          variant: 'Title',
                        },
                        h,
                      ),
                    ],
                  ),
                  h.div(
                    [h.Class('flex shrink-0 items-center gap-2')],
                    [
                      SegmentedControl.view(
                        {
                          label: 'Show cards as',
                          choices: [
                            { value: 'Grid', label: 'Grid' },
                            { value: 'List', label: 'List' },
                          ] satisfies ReadonlyArray<
                            SegmentedControl.Choice<Layout>
                          >,
                          selected: context.model.layout,
                          onSelect: layout =>
                            Message.SelectedLayout({ layout }),
                        },
                        h,
                      ),
                      IconButton.view(
                        {
                          icon: 'DocumentDuplicate',
                          label: 'Copy deck code',
                          action: {
                            _tag: 'Click',
                            message: Message.ClickedCopyCode(),
                          },
                        },
                        h,
                      ),
                    ],
                  ),
                ],
              ),
              Option.match(context.maybeLegend, {
                onNone: () =>
                  h.p(
                    [h.Class('text-sm text-fg-muted')],
                    ['Choose a legend to set the deck’s domains.'],
                  ),
                onSome: legend =>
                  h.div(
                    [h.AriaLabel('Domains'), h.Class('flex flex-wrap gap-1.5')],
                    Array.map(legend.domains, domain =>
                      Badge.view({ content: [domain], tone: domain }, h),
                    ),
                  ),
              }),
              problemsView(context, ['Legend', 'ChosenChampion'], h),
              exportView(context.model, h),
            ],
          ),
        ],
      ),
    ],
  )
}

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
  { collection, maybeWanted }: ViewInputs,
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
    maybeWanted,
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
            [h.Class('flex min-w-0 flex-col gap-10')],
            [
              zoneView(context, 'Main', contents.main, h),
              zoneView(context, 'Runes', contents.runes, h),
              zoneView(context, 'Battlefields', contents.battlefields, h),
              zoneView(context, 'Sideboard', contents.sideboard, h),
              additionalLegendsView(context, h),
            ],
          ),
          sidePanelView(context, h),
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
