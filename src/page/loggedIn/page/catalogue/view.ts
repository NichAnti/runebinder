import { Array, Match, Option, Order, pipe } from 'effect'
import { Submodel } from 'foldkit'
import type { Html, HtmlBuilder } from 'foldkit/html'

import {
  CatalogueQuery,
  CatalogueSearch,
  Collection,
  Printing,
  Wishlist,
} from '../../../../domain'
import {
  Button,
  Disclosure,
  FilterChip,
  Notice,
  RangeFilter,
  SearchField,
  SegmentedControl,
  Select,
} from '../../../../ui'
import * as CardPanel from '../../cardPanel'
import * as CollectionState from '../../collection'
import { Message } from './message'
import { type Model, Results } from './model'
import { summaryView } from './summaryView'
import { wantedSummaryView } from './wantedSummaryView'

export type ViewInputs = Readonly<{
  query: CatalogueQuery.Query
  allValues: CatalogueSearch.Facets
  printingSets: Collection.PrintingSets
  collection: CollectionState.Model
  maybeWanted: Option.Option<Wishlist.Wanted>
}>

const COLLAPSED_TAG_COUNT = 20

type FacetGroup = Readonly<{
  facet: CatalogueSearch.FacetName
  label: string
  order: ReadonlyArray<string>
}>

const FACET_GROUPS: ReadonlyArray<FacetGroup> = [
  { facet: 'set', label: 'Set', order: [] },
  { facet: 'type', label: 'Type', order: Printing.CardType.literals },
  {
    facet: 'supertype',
    label: 'Supertype',
    order: Printing.Supertype.literals,
  },
  { facet: 'domain', label: 'Domain', order: Printing.Domain.literals },
  { facet: 'rarity', label: 'Rarity', order: Printing.Rarity.literals },
  { facet: 'variant', label: 'Printings', order: Printing.Variant.literals },
  { facet: 'keyword', label: 'Keyword', order: [] },
  { facet: 'tag', label: 'Tag', order: [] },
]

const RANGE_FIELDS: ReadonlyArray<
  Readonly<{ field: CatalogueQuery.RangeField; label: string }>
> = [
  { field: 'energy', label: 'Energy' },
  { field: 'might', label: 'Might' },
  { field: 'power', label: 'Power' },
]

const VALUE_LABELS: Readonly<Record<string, string>> = {
  AlternateArt: 'Alternate art',
  Base: 'Standard',
}

const valueLabel = (value: string): string => VALUE_LABELS[value] ?? value

const SORT_LABELS: Readonly<Record<CatalogueQuery.SortField, string>> = {
  Relevance: 'Relevance',
  Number: 'Set and number',
  Name: 'Name',
  Energy: 'Energy',
  Might: 'Might',
  Power: 'Power',
}

const directionLabel = (
  field: CatalogueQuery.SortField,
  direction: CatalogueQuery.SortDirection,
): string => {
  if (field === 'Name') {
    return direction === 'Ascending' ? 'A–Z' : 'Z–A'
  } else {
    return direction === 'Ascending' ? 'low to high' : 'high to low'
  }
}

const sortLabel = (sort: CatalogueQuery.Sort): string =>
  Match.value(sort.field).pipe(
    Match.withReturnType<string>(),
    Match.when('Relevance', () => 'Relevance'),
    Match.when('Number', () => 'Set and number'),
    Match.orElse(
      field => `${SORT_LABELS[field]} ${directionLabel(field, sort.direction)}`,
    ),
  )

const orderedValues = (
  group: FacetGroup,
  values: ReadonlyArray<CatalogueSearch.FacetValue>,
): ReadonlyArray<CatalogueSearch.FacetValue> =>
  Match.value(group.facet).pipe(
    Match.withReturnType<ReadonlyArray<CatalogueSearch.FacetValue>>(),
    Match.when('set', () =>
      Array.sort(
        values,
        Order.mapInput(Order.Number, ({ value }: CatalogueSearch.FacetValue) =>
          Printing.setReleaseRank(value),
        ),
      ),
    ),
    Match.when(
      facet => facet === 'keyword' || facet === 'tag',
      () => values,
    ),
    Match.orElse(() =>
      Array.sort(
        values,
        Order.mapInput(Order.Number, ({ value }: CatalogueSearch.FacetValue) =>
          pipe(
            Array.findFirstIndex(group.order, known => known === value),
            Option.getOrElse(() => Array.length(group.order)),
          ),
        ),
      ),
    ),
  )

const countOf = (
  maybeResult: Option.Option<CatalogueSearch.SearchResult>,
  facet: CatalogueSearch.FacetName,
  value: string,
): number =>
  pipe(
    maybeResult,
    Option.flatMap(result =>
      Array.findFirst(result.facets[facet], entry => entry.value === value),
    ),
    Option.match({ onNone: () => 0, onSome: ({ count }) => count }),
  )

const facetGroupView = (
  model: Model,
  inputs: ViewInputs,
  group: FacetGroup,
  h: HtmlBuilder<Message>,
): Html => {
  const maybeResult = Results.match(model.results, {
    Waiting: () => Option.none(),
    Showing: ({ result }) => Option.some(result),
  })
  const selected = CatalogueQuery.selectedValues(inputs.query, group.facet)
  const values = orderedValues(group, inputs.allValues[group.facet])
  const isCollapsed =
    group.facet === 'tag' &&
    !model.isShowingAllTags &&
    Array.length(values) > COLLAPSED_TAG_COUNT
  const shown = isCollapsed ? Array.take(values, COLLAPSED_TAG_COUNT) : values

  return h.fieldset(
    [h.Class('flex flex-col gap-2')],
    [
      h.legend([h.Class('text-sm font-medium text-fg')], [group.label]),
      h.div(
        [h.Class('flex flex-wrap gap-1.5')],
        [
          ...Array.map(shown, ({ value }) =>
            FilterChip.view(
              {
                content: [valueLabel(value)],
                count: countOf(maybeResult, group.facet, value),
                isSelected: Array.contains(selected, value),
                onToggle: Message.ToggledFilter({ facet: group.facet, value }),
              },
              h,
            ),
          ),
          ...(isCollapsed
            ? [
                Button.view(
                  {
                    content: [`Show all ${Array.length(values)}`],
                    variant: 'Secondary',
                    onClick: Message.ClickedShowAllTags(),
                  },
                  h,
                ),
              ]
            : []),
        ],
      ),
    ],
  )
}

const filtersView = (
  model: Model,
  inputs: ViewInputs,
  idPrefix: string,
  h: HtmlBuilder<Message>,
): ReadonlyArray<Html> => [
  ...Array.map(FACET_GROUPS, group => facetGroupView(model, inputs, group, h)),
  ...Array.map(RANGE_FIELDS, ({ field, label }) =>
    RangeFilter.view(
      {
        id: `${idPrefix}-${field}`,
        label,
        maybeMin: inputs.query[field].maybeMin,
        maybeMax: inputs.query[field].maybeMax,
        onChangeMin: value =>
          Message.ChangedRange({ field, bound: 'Min', value }),
        onChangeMax: value =>
          Message.ChangedRange({ field, bound: 'Max', value }),
      },
      h,
    ),
  ),
]

const activeFiltersView = (
  inputs: ViewInputs,
  h: HtmlBuilder<Message>,
): Html =>
  CatalogueQuery.activeFilterCount(inputs.query) === 0
    ? h.empty
    : h.div(
        [h.Class('flex flex-wrap items-center gap-1.5')],
        [
          ...Array.flatMap(FACET_GROUPS, ({ facet }) =>
            Array.map(
              CatalogueQuery.selectedValues(inputs.query, facet),
              value =>
                Button.view(
                  {
                    content: [`${valueLabel(value)} ×`],
                    variant: 'Secondary',
                    onClick: Message.ToggledFilter({ facet, value }),
                  },
                  h,
                ),
            ),
          ),
          Button.view(
            {
              content: ['Clear filters'],
              variant: 'Secondary',
              onClick: Message.ClickedClearFilters(),
            },
            h,
          ),
        ],
      )

const OWNERSHIP_LABELS: Readonly<Record<CatalogueQuery.Ownership, string>> = {
  All: 'All cards',
  Owned: 'My collection',
  Wanted: 'Wanted',
}

const ownershipView = (inputs: ViewInputs, h: HtmlBuilder<Message>): Html =>
  SegmentedControl.view(
    {
      label: 'Show',
      choices: Array.map(CatalogueQuery.Ownership.literals, ownership => ({
        value: ownership,
        label: OWNERSHIP_LABELS[ownership],
      })),
      selected: inputs.query.ownership,
      onSelect: value => Message.SelectedOwnership({ value }),
    },
    h,
  )

const printingCountText = (
  printingIds: ReadonlyArray<Printing.PrintingId>,
): string =>
  Array.length(printingIds) === 1
    ? '1 printing'
    : `${Array.length(printingIds)} printings`

const highlightsOf = (
  { collection, maybeWanted }: ViewInputs,
  printingIds: ReadonlyArray<Printing.PrintingId>,
): ReadonlyArray<string> =>
  Array.getSomes([
    pipe(
      CollectionState.maybeOwned(collection),
      Option.map(owned => Collection.totalOf(owned, printingIds)),
      Option.filter(total => total > 0),
      Option.map(total => `Owned ${total}`),
    ),
    pipe(
      maybeWanted,
      Option.map(wanted => Wishlist.wantedCopiesOf(wanted, printingIds)),
      Option.filter(total => total > 0),
      Option.map(total => `Need ${total}`),
    ),
  ])

const sortView = (inputs: ViewInputs, h: HtmlBuilder<Message>): Html => {
  const current = CatalogueQuery.effectiveSort(inputs.query)
  const choices = Array.filter(
    CatalogueQuery.SORT_CHOICES,
    sort => sort.field !== 'Relevance' || Option.isSome(inputs.query.q),
  )

  return Select.view(
    {
      id: 'catalogue-sort',
      label: 'Sort by',
      value: CatalogueQuery.formatSort(current),
      options: Array.map(choices, sort => ({
        value: CatalogueQuery.formatSort(sort),
        label: sortLabel(sort),
      })),
      onChange: value => Message.SelectedSort({ value }),
    },
    h,
  )
}

const isUnfiltered = (query: CatalogueQuery.Query): boolean =>
  Option.isNone(query.q) && CatalogueQuery.activeFilterCount(query) === 0

const noResultsView = ({ query }: ViewInputs, h: HtmlBuilder<Message>): Html =>
  query.ownership === 'Owned' && isUnfiltered(query)
    ? Notice.view(
        {
          title: 'Your collection is empty',
          description: ['Open a card and use + on the printings you own.'],
          actions: [
            Button.view(
              {
                content: ['Show all cards'],
                variant: 'Secondary',
                onClick: Message.SelectedOwnership({ value: 'All' }),
              },
              h,
            ),
          ],
        },
        h,
      )
    : Notice.view(
        {
          title: 'No cards match',
          description: ['Try a different search or remove some filters.'],
          actions: [
            Button.view(
              {
                content: ['Clear filters'],
                onClick: Message.ClickedClearFilters(),
              },
              h,
            ),
          ],
        },
        h,
      )

const resultsView = (
  model: Model,
  inputs: ViewInputs,
  h: HtmlBuilder<Message>,
): Html =>
  Results.match(model.results, {
    Waiting: () =>
      Notice.view(
        {
          title: 'Searching…',
          description: ['Looking through the catalogue.'],
        },
        h,
      ),
    Showing: ({ result }) =>
      Array.match(result.cards, {
        onEmpty: () => noResultsView(inputs, h),
        onNonEmpty: cards =>
          h.div(
            [h.Class('flex flex-col gap-6')],
            [
              h.ul(
                [
                  h.Class(
                    'grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5',
                  ),
                ],
                Array.map(cards, card =>
                  h.keyed('li')(
                    card.id,
                    [],
                    [
                      h.submodel({
                        slotId: `card-${card.id}`,
                        model: model.cardPanel,
                        view: CardPanel.tileView,
                        viewInputs: {
                          cardId: card.id,
                          label: Option.match(card.maybeSubtitle, {
                            onNone: () => card.name,
                            onSome: subtitle => `${card.name}, ${subtitle}`,
                          }),
                          trigger: {
                            _tag: 'Tile',
                            tile: {
                              imageUrl: card.imageUrl,
                              imageAlt: Option.getOrElse(
                                card.maybeAccessibilityText,
                                () => card.name,
                              ),
                              title: card.name,
                              maybeSubtitle: card.maybeSubtitle,
                              domains: card.domains,
                              meta: printingCountText(card.printingIds),
                              highlights: highlightsOf(
                                inputs,
                                card.printingIds,
                              ),
                            },
                          },
                          counts: CollectionState.countsOf(inputs.collection),
                        },
                        toParentMessage: message =>
                          Message.GotCardPanelMessage({ message }),
                      }),
                    ],
                  ),
                ),
              ),
              Array.length(cards) < result.total
                ? h.div(
                    [h.Class('flex justify-center')],
                    [
                      Button.view(
                        {
                          content: ['Show more'],
                          variant: 'Secondary',
                          onClick: Message.ClickedShowMore(),
                        },
                        h,
                      ),
                    ],
                  )
                : h.empty,
            ],
          ),
      }),
  })

const viewSummaryView = (inputs: ViewInputs, h: HtmlBuilder<Message>): Html =>
  Match.value(inputs.query.ownership).pipe(
    Match.withReturnType<Html>(),
    Match.when('All', () => h.empty),
    Match.when('Owned', () =>
      summaryView(
        {
          collection: inputs.collection,
          printingSets: inputs.printingSets,
          onRetry: Message.ClickedRetryCollection(),
        },
        h,
      ),
    ),
    Match.when('Wanted', () =>
      Option.match(inputs.maybeWanted, {
        onNone: () =>
          Notice.view({ title: 'Loading what you need…', description: [] }, h),
        onSome: wanted => wantedSummaryView(wanted, h),
      }),
    ),
    Match.exhaustive,
  )

const countText = (model: Model): string =>
  Results.match(model.results, {
    Waiting: () => 'Searching…',
    Showing: ({ result }) =>
      result.total === 1 ? '1 card' : `${result.total} cards`,
  })

export const view = Submodel.defineView<Model, Message, ViewInputs>(
  (model, inputs, h) => {
    const activeCount = CatalogueQuery.activeFilterCount(inputs.query)

    return h.div(
      [h.Class('flex flex-col gap-6')],
      [
        h.div(
          [h.Class('flex flex-col gap-3')],
          [
            h.div(
              [h.Class('flex flex-wrap items-center justify-between gap-3')],
              [
                h.h1([h.Class('text-2xl font-semibold')], ['Cards']),
                ownershipView(inputs, h),
              ],
            ),
            viewSummaryView(inputs, h),
            SearchField.view(
              {
                id: 'catalogue-search',
                label: 'Search cards',
                value: model.searchText,
                placeholder: 'Search cards, abilities, tags, artists…',
                onInput: value => Message.UpdatedSearch({ value }),
              },
              h,
            ),
          ],
        ),
        h.div(
          [h.Class('grid gap-8 lg:grid-cols-[18rem_1fr]')],
          [
            h.aside(
              [h.AriaLabel('Filters'), h.Class('flex flex-col gap-4')],
              [
                h.div(
                  [h.Class('lg:hidden')],
                  [
                    Disclosure.view(
                      {
                        id: 'catalogue-filters',
                        summary: [
                          activeCount === 0
                            ? 'Filters'
                            : `Filters (${activeCount} active)`,
                        ],
                        content: filtersView(model, inputs, 'mobile', h),
                        isOpen: model.isFiltersOpen,
                        onToggle: isOpen =>
                          Message.ToggledFiltersPanel({ isOpen }),
                      },
                      h,
                    ),
                  ],
                ),
                h.div(
                  [h.Class('hidden flex-col gap-5 lg:flex')],
                  filtersView(model, inputs, 'desktop', h),
                ),
              ],
            ),
            h.section(
              [h.AriaLabel('Results'), h.Class('flex flex-col gap-4')],
              [
                h.div(
                  [
                    h.Class(
                      'flex flex-wrap items-center justify-between gap-3',
                    ),
                  ],
                  [
                    h.p(
                      [h.AriaLive('polite'), h.Class('text-sm text-fg-muted')],
                      [countText(model)],
                    ),
                    h.div(
                      [h.Class('flex flex-wrap items-center gap-3')],
                      [sortView(inputs, h)],
                    ),
                  ],
                ),
                activeFiltersView(inputs, h),
                resultsView(model, inputs, h),
              ],
            ),
          ],
        ),
      ],
    )
  },
)
