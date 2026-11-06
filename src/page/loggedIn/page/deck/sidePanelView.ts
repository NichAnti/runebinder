import { Array, Match, Number, Option, String, pipe } from 'effect'
import type { Html, HtmlBuilder } from 'foldkit/html'

import { type CatalogueSearch, Deck, Printing } from '../../../../domain'
import {
  Button,
  CardTile,
  Checkbox,
  IconButton,
  SearchField,
  SegmentedControl,
  Tabs,
} from '../../../../ui'
import { type Context, TAB_LABELS, TILE_GRID, badgesFor } from './context'
import { countersView } from './lineView'
import { type Line, groupsOf, linesOf } from './lines'
import { Message } from './message'
import { type AddTab, SideTabs } from './model'
import { missingView } from './view'
import { GROUP_LABELS, curveView } from './zoneView'

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
        ? h.div(
            [h.Class('mt-auto')],
            [
              Button.view(
                {
                  content: [
                    tab === 'AdditionalLegend'
                      ? `Add ${label}`
                      : `Choose ${label}`,
                  ],
                  variant: 'Secondary',
                  onClick: Message.ClickedAddCard({
                    cardId: card.id,
                    target: 'Deck',
                  }),
                },
                h,
              ),
            ],
          )
        : h.div(
            [h.Class('mt-auto')],
            [
              countersView(
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

const sheetContent = (
  context: Context,
  content: ReadonlyArray<Html>,
  h: HtmlBuilder<Message>,
): ReadonlyArray<Html> => [
  h.div(
    [
      h.Class(
        context.model.isSheetOpen
          ? 'flex flex-col gap-3'
          : 'hidden flex-col gap-3 lg:flex',
      ),
    ],
    content,
  ),
]

const sheetToggleView = (context: Context, h: HtmlBuilder<Message>): Html =>
  h.div(
    [h.Class('flex justify-end lg:hidden')],
    [
      IconButton.view(
        {
          icon: context.model.isSheetOpen ? 'XMark' : 'ChevronUp',
          label: context.model.isSheetOpen
            ? 'Hide deck tools'
            : 'Show deck tools',
          size: 'Small',
          action: { _tag: 'Click', message: Message.ClickedToggleSheet() },
        },
        h,
      ),
    ],
  )

export const sidePanelView = (
  context: Context,
  h: HtmlBuilder<Message>,
): Html =>
  h.aside(
    [
      h.AriaLabel('Deck tools'),
      h.Class(
        `fixed inset-x-0 bottom-0 z-20 flex flex-col gap-2 overflow-y-auto rounded-t-card border-t border-border bg-surface p-4 shadow-raised lg:sticky lg:top-20 lg:z-auto lg:max-h-[calc(100vh-6rem)] lg:gap-3 lg:rounded-card lg:border lg:shadow-none ${context.model.isSheetOpen ? 'max-h-[75vh]' : ''}`,
      ),
    ],
    [
      sheetToggleView(context, h),
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
            sheetContent(
              context,
              panel === 'Stats'
                ? statsView(context, h)
                : addCardsView(context, h),
              h,
            ),
        },
        h,
      ),
    ],
  )
