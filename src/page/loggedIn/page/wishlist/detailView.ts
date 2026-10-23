import { Array, Number, Option, Record } from 'effect'
import type { Html, HtmlBuilder } from 'foldkit/html'

import {
  type CatalogueSearch,
  Collection,
  type Printing,
  Wishlist,
} from '../../../../domain'
import { wishlistsRouter } from '../../../../route'
import {
  Button,
  Checkbox,
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
        'flex flex-wrap items-center gap-3 rounded-card border border-border bg-surface p-3',
      ),
    ],
    [
      Checkbox.view(
        {
          id: `select-${lineKey}`,
          label: `Select ${label}`,
          isChecked: Option.getOrElse(
            Record.get(model.selected, lineKey),
            () => false,
          ),
          onToggle: isChecked => Message.ToggledLine({ lineKey, isChecked }),
        },
        h,
      ),
      ...Option.match(maybePrinting, {
        onNone: () => [],
        onSome: printing => [
          h.img([
            h.Src(printing.imageUrl),
            h.Alt(''),
            h.Loading('lazy'),
            h.Class('w-12 rounded-control bg-surface-raised'),
          ]),
        ],
      }),
      h.div(
        [h.Class('flex min-w-48 flex-1 flex-col gap-0.5')],
        [
          h.span(
            [h.Class('text-sm font-semibold')],
            [`${line.quantity}× ${label}`],
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
          ...Option.match(
            Option.flatMap(
              maybePrinting,
              ({ maybeCardTrader }) => maybeCardTrader,
            ),
            {
              onNone: () => [],
              onSome: blueprint => [
                Link.view(
                  {
                    href: Wishlist.cardTraderCardUrl(blueprint.id),
                    content: ['This version on CardTrader'],
                    isExternal: true,
                  },
                  h,
                ),
              ],
            },
          ),
        ],
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
          ]
        : []),
      ...Option.match(maybeCard, {
        onNone: () => [],
        onSome: card => [
          Select.view(
            {
              id: `version-${lineKey}`,
              label: 'Bought version',
              value: Option.getOrElse(
                Record.get(model.versions, lineKey),
                () => line.printingId,
              ),
              options: Array.map(card.printings, printing => ({
                value: printing.id,
                label: versionLabel(printing),
              })),
              onChange: value => Message.SelectedVersion({ lineKey, value }),
            },
            h,
          ),
        ],
      }),
      Button.view(
        {
          content: ['Bought'],
          variant: 'Secondary',
          onClick: Message.ClickedBought({
            purchases: [purchaseOf(model, section, line)],
          }),
        },
        h,
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
    [h.Class('flex items-center justify-between gap-3')],
    [
      h.span(
        [h.Class('text-sm')],
        [
          Option.match(card.maybeSubtitle, {
            onNone: () => card.name,
            onSome: subtitle => `${card.name}, ${subtitle}`,
          }),
        ],
      ),
      Button.view(
        {
          content: ['Add'],
          variant: 'Secondary',
          onClick: Message.ClickedAddCard({ cardId: card.id }),
        },
        h,
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
              h.Class(
                'flex flex-col gap-2 rounded-card border border-border bg-surface p-3',
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

  return h.div(
    [h.Class('flex flex-wrap gap-2')],
    [
      ...Array.match(selectedLines, {
        onEmpty: () => [],
        onNonEmpty: selected => [
          Button.view(
            {
              content: ['Mark selected as bought'],
              variant: 'Secondary',
              onClick: Message.ClickedBought({
                purchases: Array.map(selected, line =>
                  purchaseOf(model, section, line),
                ),
              }),
            },
            h,
          ),
        ],
      }),
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
          'CardTrader wishlists keep the card and the set, not the version, so the Shop Optimizer may offer any version. Use the links beside each card for an exact version.',
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
              h.ul(
                [
                  h.AriaLabel(`${section.title} cards`),
                  h.Class('flex flex-col gap-2'),
                ],
                Array.map(lines, line => lineView(model, section, line, h)),
              ),
              markBoughtView(model, section, lines, h),
            ],
          ),
      }),
    ],
  )
