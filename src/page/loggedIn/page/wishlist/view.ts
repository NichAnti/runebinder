import { Array, Match, Number, Option, Record } from 'effect'
import { Submodel } from 'foldkit'
import type { Html, HtmlBuilder } from 'foldkit/html'

import {
  type CatalogueSearch,
  Collection,
  type Printing,
  Wishlist,
} from '../../../../domain'
import { cardTraderRouter } from '../../../../route'
import {
  Button,
  Checkbox,
  Link,
  Notice,
  QuantityStepper,
  SearchField,
  Select,
  Toast,
} from '../../../../ui'
import { VARIANT_LABELS } from '../../printings'
import * as WishlistState from '../../wishlist'
import { cardsByPrinting, nameOf } from '../deck/lines'
import { Message, type Purchase } from './message'
import type { Model } from './model'
import { type Context, type Section, lineKeyOf, sectionsOf } from './sections'
import { finderOf } from './update'

export type ViewInputs = Readonly<{
  isReady: boolean
  hasFailed: boolean
  context: Context
  wishlist: WishlistState.Model
}>

const FAILURE_TEXT: Readonly<Record<WishlistState.SendFailure, string>> = {
  NotConnected: 'Connect your CardTrader account first.',
  InvalidToken: 'CardTrader rejected your token. Connect it again.',
  RateLimited: 'CardTrader is limiting requests. Wait a moment and try again.',
  Unavailable: 'CardTrader could not be reached. Try again later.',
}

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
              ({ maybeCardTraderBlueprintId }) => maybeCardTraderBlueprintId,
            ),
            {
              onNone: () => [],
              onSome: blueprintId => [
                Link.view(
                  {
                    href: Wishlist.cardTraderCardUrl(blueprintId),
                    content: ['This version on CardTrader'],
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

const sendStatusView = (
  wishlist: WishlistState.Model,
  section: Section,
  h: HtmlBuilder<Message>,
): Html =>
  WishlistState.Sending.match(
    WishlistState.sendingOf(wishlist, WishlistState.targetKey(section.target)),
    {
      Idle: () => h.empty,
      Sending: () => h.empty,
      Sent: ({ wishlistId, isPreviousDeleted }) =>
        h.p(
          [h.Role('status'), h.Class('flex flex-wrap gap-2 text-sm')],
          [
            Link.view(
              {
                href: Wishlist.cardTraderWishlistUrl(wishlistId),
                content: ['Open it on CardTrader'],
              },
              h,
            ),
            isPreviousDeleted
              ? ''
              : 'The previous one could not be deleted; remove it on CardTrader.',
          ],
        ),
      Failed: ({ reason }) =>
        h.p(
          [
            h.Role('alert'),
            h.Class('flex flex-wrap gap-2 text-sm text-danger'),
          ],
          [
            FAILURE_TEXT[reason],
            ...(reason === 'NotConnected' || reason === 'InvalidToken'
              ? [
                  Link.view(
                    {
                      href: cardTraderRouter(),
                      content: ['Connect CardTrader'],
                    },
                    h,
                  ),
                ]
              : []),
          ],
        ),
    },
  )

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

const sectionView = (
  model: Model,
  wishlist: WishlistState.Model,
  section: Section,
  h: HtmlBuilder<Message>,
): Html => {
  const copies = Number.sumAll(
    Array.map(section.lines, ({ quantity }) => quantity),
  )
  const selectedLines = Array.filter(section.lines, line =>
    Option.getOrElse(
      Record.get(model.selected, lineKeyOf(section, line.printingId)),
      () => false,
    ),
  )
  const isSending =
    WishlistState.sendingOf(wishlist, WishlistState.targetKey(section.target))
      ._tag === 'Sending'

  return h.section(
    [h.AriaLabel(section.title), h.Class('flex flex-col gap-3')],
    [
      h.div(
        [h.Class('flex flex-wrap items-center justify-between gap-3')],
        [
          h.h2(
            [h.Class('flex items-baseline gap-2 text-lg font-semibold')],
            [
              section.title,
              h.span(
                [h.Class('text-sm font-normal tabular-nums text-fg-muted')],
                [copies === 1 ? '1 copy' : `${copies} copies`],
              ),
            ],
          ),
          Button.view(
            {
              content: [isSending ? 'Sending…' : 'Send to CardTrader'],
              onClick: Message.ClickedSend({ target: section.target }),
              isDisabled:
                isSending || Array.isReadonlyArrayEmpty(section.lines),
            },
            h,
          ),
        ],
      ),
      sendStatusView(wishlist, section, h),
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
              h.div(
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
              ),
            ],
          ),
      }),
    ],
  )
}

const readyView = (
  model: Model,
  { context, wishlist }: ViewInputs,
  h: HtmlBuilder<Message>,
): Html =>
  h.div(
    [h.Class('flex flex-col gap-10')],
    [
      Notice.view(
        {
          title: 'About CardTrader wishlists',
          description: [
            'CardTrader wishlists keep the card and the set, not the version, so the Shop Optimizer may offer any version. Use the links beside each card for an exact version. Sending again replaces the wishlist this app sent for that deck or list.',
          ],
        },
        h,
      ),
      ...Array.map(sectionsOf(context), section =>
        sectionView(model, wishlist, section, h),
      ),
      Toast.view(
        {
          slotId: 'wishlist-toast',
          model: model.toast,
          toParentMessage: message => Message.GotToastMessage({ message }),
        },
        h,
      ),
    ],
  )

export const view = Submodel.defineView<Model, Message, ViewInputs>(
  (model, inputs, h) =>
    h.section(
      [h.Class('flex flex-col gap-6')],
      [
        h.h1([h.Class('text-2xl font-semibold')], ['Wishlists']),
        Match.value(inputs).pipe(
          Match.withReturnType<Html>(),
          Match.when({ hasFailed: true }, () =>
            Notice.view(
              {
                title: 'Your wishlists could not be loaded',
                description: ['Check your connection and try again.'],
                variant: 'Error',
                actions: [
                  Button.view(
                    { content: ['Try again'], onClick: Message.ClickedRetry() },
                    h,
                  ),
                ],
              },
              h,
            ),
          ),
          Match.when({ isReady: true }, () => readyView(model, inputs, h)),
          Match.orElse(() =>
            Notice.view(
              { title: 'Loading your wishlists…', description: [] },
              h,
            ),
          ),
        ),
      ],
    ),
)
