import { Array, Number, Option, Order, Record } from 'effect'
import type { Html, HtmlBuilder } from 'foldkit/html'

import {
  type CatalogueSearch,
  Collection,
  type Printing,
  Wishlist,
} from '../../../../domain'
import { wishlistsRouter } from '../../../../route'
import {
  Badge,
  Button,
  CardTile,
  Checkbox,
  IconButton,
  Link,
  QuantityStepper,
  SearchField,
  Select,
} from '../../../../ui'
import { VARIANT_LABELS } from '../../printings'
import { cardsByPrinting, nameOf } from '../deck/lines'
import {
  type CardTraderInputs,
  actionsView,
  failureView,
  statusView,
} from './cardTraderView'
import { Message, type Purchase } from './message'
import type { Model } from './model'
import { type Section, lineKeyOf } from './sections'
import { finderOf } from './update'

const versionLabel = (printing: Printing.Printing): string =>
  `${VARIANT_LABELS[printing.variant]} · ${printing.publicCode}`

const purchaseOf = (
  model: Model,
  section: Section,
  line: Wishlist.Line,
): Purchase => ({
  wanted: line.printingId,
  bought: Option.getOrElse(
    Record.get(model.versions, lineKeyOf(section, line.printingId)),
    () => line.printingId,
  ),
  copies: line.quantity,
  isCustom: section.isCustom,
})

const labelOf = (model: Model, printingId: Printing.PrintingId): string =>
  Option.match(
    Option.fromNullishOr(cardsByPrinting(model.cards).get(printingId)),
    {
      onNone: () => printingId,
      onSome: nameOf,
    },
  )

const byName = (model: Model) =>
  Order.mapInput(Order.String, (line: Wishlist.Line) =>
    labelOf(model, line.printingId),
  )

const lineView = (
  model: Model,
  section: Section,
  line: Wishlist.Line,
  h: HtmlBuilder<Message>,
): Html => {
  const lineKey = lineKeyOf(section, line.printingId)
  const maybePrinting = finderOf(model)(line.printingId)
  const maybeCard = Option.fromNullishOr(
    cardsByPrinting(model.cards).get(line.printingId),
  )
  const label = Option.match(maybeCard, {
    onNone: () => line.printingId,
    onSome: nameOf,
  })

  return h.keyed('li')(
    lineKey,
    [
      h.Class(
        'grid grid-cols-[auto_3rem_minmax(0,1fr)] items-center gap-3 rounded-card border border-border bg-surface p-3 sm:grid-cols-[auto_3rem_minmax(0,1fr)_auto]',
      ),
    ],
    [
      Checkbox.view(
        {
          id: `select-${lineKey}`,
          label: `Select ${label}`,
          isLabelHidden: true,
          isChecked: Option.getOrElse(
            Record.get(model.selected, lineKey),
            () => false,
          ),
          onToggle: isChecked => Message.ToggledLine({ lineKey, isChecked }),
        },
        h,
      ),
      Option.match(maybePrinting, {
        onNone: () =>
          h.div([
            h.Class('aspect-[744/1039] w-12 rounded-control bg-surface-raised'),
          ]),
        onSome: printing =>
          h.img([
            h.Src(printing.imageUrl),
            h.Alt(''),
            h.Loading('lazy'),
            h.Class('w-12 rounded-control bg-surface-raised'),
          ]),
      }),
      h.div(
        [h.Class('flex min-w-0 flex-col gap-0.5')],
        [
          h.span(
            [
              h.Class(
                'flex flex-wrap items-center gap-2 text-sm font-semibold',
              ),
            ],
            [
              label,
              ...(section.isCustom
                ? []
                : [
                    Badge.view(
                      { content: [`Need ${line.quantity}`], tone: 'Accent' },
                      h,
                    ),
                  ]),
            ],
          ),
          h.span(
            [h.Class('text-xs text-fg-muted')],
            [
              Option.match(maybePrinting, {
                onNone: () => '',
                onSome: versionLabel,
              }),
            ],
          ),
        ],
      ),
      h.div(
        [
          h.Class(
            'col-span-full flex flex-wrap items-center justify-end gap-2 sm:col-span-1',
          ),
        ],
        [
          ...Option.match(
            Option.filter(maybeCard, card => Array.length(card.printings) > 1),
            {
              onNone: () => [],
              onSome: card => [
                Select.view(
                  {
                    id: `version-${lineKey}`,
                    label: 'Arrived as',
                    value: Option.getOrElse(
                      Record.get(model.versions, lineKey),
                      () => line.printingId,
                    ),
                    options: Array.map(card.printings, printing => ({
                      value: printing.id,
                      label: versionLabel(printing),
                    })),
                    onChange: value =>
                      Message.SelectedVersion({ lineKey, value }),
                  },
                  h,
                ),
              ],
            },
          ),
          ...(section.isCustom
            ? [
                QuantityStepper.view(
                  {
                    label: `Wanted: ${label}`,
                    quantity: line.added,
                    max: Collection.MAX_QUANTITY,
                    onDecrement: Message.ClickedStepAdded({
                      printingId: line.printingId,
                      step: -1,
                    }),
                    onIncrement: Message.ClickedStepAdded({
                      printingId: line.printingId,
                      step: 1,
                    }),
                  },
                  h,
                ),
                IconButton.view(
                  {
                    icon: 'Trash',
                    label: `Remove ${label}`,
                    variant: 'Danger',
                    action: {
                      _tag: 'Click',
                      message: Message.ClickedRemoveAdded({
                        printingId: line.printingId,
                      }),
                    },
                  },
                  h,
                ),
              ]
            : []),
          IconButton.view(
            {
              icon: 'Check',
              label: `Mark ${label} as bought`,
              action: {
                _tag: 'Click',
                message: Message.ClickedBought({
                  purchases: [purchaseOf(model, section, line)],
                }),
              },
            },
            h,
          ),
          ...Option.match(
            Option.flatMap(
              maybePrinting,
              ({ maybeCardTrader }) => maybeCardTrader,
            ),
            {
              onNone: () => [],
              onSome: blueprint => [
                IconButton.view(
                  {
                    icon: 'ArrowTopRightOnSquare',
                    label: `Open this version of ${label} on CardTrader`,
                    action: {
                      _tag: 'External',
                      href: Wishlist.cardTraderCardUrl(blueprint.id),
                    },
                  },
                  h,
                ),
              ],
            },
          ),
        ],
      ),
    ],
  )
}

const searchResultView = (
  card: CatalogueSearch.CardSummary,
  h: HtmlBuilder<Message>,
): Html =>
  h.keyed('li')(
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
          highlights: [],
        },
        h,
      ),
      h.div(
        [h.Class('mt-auto')],
        [
          Button.view(
            {
              content: ['Add'],
              variant: 'Secondary',
              onClick: Message.ClickedAddCard({ cardId: card.id }),
            },
            h,
          ),
        ],
      ),
    ],
  )

const addView = (model: Model, h: HtmlBuilder<Message>): Html =>
  h.div(
    [h.Class('flex flex-col gap-2')],
    [
      SearchField.view(
        {
          id: 'wishlist-add',
          label: 'Add a card to the custom wishlist',
          value: model.searchText,
          placeholder: 'Add a card…',
          onInput: value => Message.UpdatedSearch({ value }),
        },
        h,
      ),
      Array.match(model.searchResults, {
        onEmpty: () => h.empty,
        onNonEmpty: results =>
          h.ul(
            [
              h.AriaLabel('Cards to add'),
              h.Class(
                'grid grid-cols-[repeat(auto-fill,minmax(8rem,1fr))] gap-3 rounded-card border border-border bg-surface p-3',
              ),
            ],
            Array.map(results, result => searchResultView(result, h)),
          ),
      }),
    ],
  )

const markBoughtView = (
  model: Model,
  section: Section,
  lines: Array.NonEmptyReadonlyArray<Wishlist.Line>,
  h: HtmlBuilder<Message>,
): Html => {
  const selectedLines = Array.filter(section.lines, line =>
    Option.getOrElse(
      Record.get(model.selected, lineKeyOf(section, line.printingId)),
      () => false,
    ),
  )
  const count = Array.length(selectedLines)

  return h.div(
    [
      h.AriaLabel('Bought'),
      h.Role('group'),
      h.Class(
        'sticky top-2 z-10 flex flex-wrap items-center gap-2 rounded-card border border-border bg-surface px-4 py-3 shadow-raised',
      ),
    ],
    [
      h.span(
        [h.Role('status'), h.Class('mr-auto text-sm text-fg-muted')],
        [
          count === 0
            ? 'Select the cards that arrived to mark them as bought.'
            : `${count} selected`,
        ],
      ),
      Button.view(
        {
          content: ['Mark selected as bought'],
          isDisabled: count === 0,
          ...Array.match(selectedLines, {
            onEmpty: () => ({}),
            onNonEmpty: selected => ({
              onClick: Message.ClickedBought({
                purchases: Array.map(selected, line =>
                  purchaseOf(model, section, line),
                ),
              }),
            }),
          }),
        },
        h,
      ),
      Button.view(
        {
          content: ['Mark all as bought'],
          variant: 'Secondary',
          onClick: Message.ClickedBought({
            purchases: Array.map(lines, line =>
              purchaseOf(model, section, line),
            ),
          }),
        },
        h,
      ),
    ],
  )
}

export const copiesText = (section: Section): string => {
  const copies = Number.sumAll(
    Array.map(section.lines, ({ quantity }) => quantity),
  )

  return copies === 1 ? '1 copy' : `${copies} copies`
}

export const detailView = (
  model: Model,
  section: Section,
  inputs: CardTraderInputs,
  h: HtmlBuilder<Message>,
): Html =>
  h.section(
    [h.AriaLabel(section.title), h.Class('flex flex-col gap-6')],
    [
      Link.view({ href: wishlistsRouter(), content: ['← All wishlists'] }, h),
      h.div(
        [h.Class('flex flex-wrap items-center justify-between gap-3')],
        [
          h.div(
            [h.Class('flex flex-col gap-1')],
            [
              h.h1(
                [h.Class('flex items-baseline gap-2 text-2xl font-semibold')],
                [
                  section.title,
                  h.span(
                    [h.Class('text-sm font-normal tabular-nums text-fg-muted')],
                    [copiesText(section)],
                  ),
                ],
              ),
              statusView(section, inputs, h),
            ],
          ),
          actionsView(model, section, inputs, h),
        ],
      ),
      failureView(section, inputs, h),
      h.p(
        [h.Class('text-sm text-fg-muted')],
        [
          'CardTrader wishlists keep the card and the set, not the version, so the Shop Optimizer may offer any version. Use the CardTrader icon beside each card for an exact version.',
        ],
      ),
      ...(section.isCustom ? [addView(model, h)] : []),
      Array.match(section.lines, {
        onEmpty: () =>
          h.p(
            [h.Class('text-sm text-fg-muted')],
            [
              section.isCustom
                ? 'No cards added yet.'
                : 'Nothing missing: your collection covers this deck.',
            ],
          ),
        onNonEmpty: lines =>
          h.div(
            [h.Class('flex flex-col gap-2')],
            [
              markBoughtView(model, section, lines, h),
              h.ul(
                [
                  h.AriaLabel(`${section.title} cards`),
                  h.Class('flex flex-col gap-2'),
                ],
                Array.map(Array.sort(lines, byName(model)), line =>
                  lineView(model, section, line, h),
                ),
              ),
            ],
          ),
      }),
    ],
  )
