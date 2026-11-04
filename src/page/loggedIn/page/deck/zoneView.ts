import { Array, Number, Option, Record } from 'effect'
import type { Html, HtmlBuilder } from 'foldkit/html'

import { Deck, DeckRules, Printing, Runes } from '../../../../domain'
import { ColumnChart, Icon, IconButton } from '../../../../ui'
import {
  type Context,
  SECTION_LABELS,
  TAB_LABELS,
  TARGETS,
  TILE_GRID,
  badgesFor,
  nameFinder,
  problemsIn,
  smallButton,
  tileOf,
} from './context'
import { roomIn } from './copies'
import {
  gridLineView,
  listLineView,
  versionCaption,
  versionPickerView,
} from './lineView'
import {
  CURVE_TOP,
  type Line,
  type TypeGroup,
  energyCurveOf,
  groupsOf,
  nameOf,
  versionLinesOf,
} from './lines'
import { Message } from './message'
import { type AddTab, sectionElementId } from './model'
import { explain } from './problemText'
import { panelView } from './view'

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

export const problemsView = (
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

export const zoneView = (
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

export const GROUP_LABELS: Readonly<Record<TypeGroup, string>> = {
  Unit: 'Units',
  Spell: 'Spells',
  Gear: 'Gear',
  Other: 'Other',
}

const curveLabel = (energy: number): string =>
  energy === CURVE_TOP ? `${CURVE_TOP}+` : `${energy}`

export const curveView = (
  lines: ReadonlyArray<Line>,
  h: HtmlBuilder<Message>,
): Html =>
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

export const identitySlotView = (
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
            'flex items-center justify-between gap-1 text-xs font-medium whitespace-nowrap text-fg-muted',
          ),
        ],
        [
          place === 'Legend' ? 'Legend' : 'Champion',
          statusIconView(context, place, h),
        ],
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

export const additionalLegendsView = (
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
