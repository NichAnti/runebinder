import { Array, Match, Number, Option } from 'effect'
import { Submodel } from 'foldkit'
import type { Html, HtmlBuilder } from 'foldkit/html'

import { type CatalogueSearch, Collection, Wishlist } from '../../../../domain'
import { cardTraderRouter } from '../../../../route'
import {
  Button,
  Link,
  Notice,
  QuantityStepper,
  SearchField,
} from '../../../../ui'
import { VARIANT_LABELS } from '../../printings'
import * as WishlistState from '../../wishlist'
import { cardsByPrinting, nameOf } from '../deck/lines'
import { Message } from './message'
import type { Model } from './model'
import { type Context, finderOf, linesFor } from './update'

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

const lineView = (
  model: Model,
  line: Wishlist.Line,
  h: HtmlBuilder<Message>,
): Html => {
  const maybePrinting = finderOf(model)(line.printingId)
  const byPrinting = cardsByPrinting(model.cards)
  const label = Option.match(
    Option.fromNullishOr(byPrinting.get(line.printingId)),
    { onNone: () => line.printingId, onSome: nameOf },
  )

  return h.keyed('li')(
    line.printingId,
    [
      h.Class(
        'flex flex-wrap items-center gap-3 rounded-card border border-border bg-surface p-3',
      ),
    ],
    [
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
          h.span([h.Class('text-sm font-semibold')], [label]),
          h.span(
            [h.Class('text-xs text-fg-muted')],
            [
              Option.match(maybePrinting, {
                onNone: () => '',
                onSome: printing =>
                  `${VARIANT_LABELS[printing.variant]} · ${printing.publicCode}`,
              }),
            ],
          ),
          h.span(
            [h.Class('text-xs text-fg-muted tabular-nums')],
            [
              `Missing from decks ${line.missing} · added by hand ${line.added} · wanted ${line.quantity}`,
            ],
          ),
        ],
      ),
      QuantityStepper.view(
        {
          label: `Added by hand: ${label}`,
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
  )
}

const sendView = (
  model: Model,
  lines: ReadonlyArray<Wishlist.Line>,
  wishlist: WishlistState.Model,
  h: HtmlBuilder<Message>,
): Html => {
  const cardTrader = Wishlist.cardTraderLinesOf(lines, finderOf(model))
  const copies = Number.sumAll(
    Array.map(cardTrader.lines, ({ quantity }) => quantity),
  )
  const sending =
    wishlist._tag === 'Ready' ? wishlist.sending : WishlistState.Sending.Idle()

  return h.section(
    [
      h.AriaLabel('Send to CardTrader'),
      h.Class(
        'flex flex-col gap-3 rounded-card border border-border bg-surface p-4 lg:sticky lg:top-4',
      ),
    ],
    [
      h.h2([h.Class('text-base font-semibold')], ['Send to CardTrader']),
      h.p(
        [h.Class('text-sm text-fg-muted tabular-nums')],
        [
          Array.length(cardTrader.lines) === 1
            ? `1 card, ${copies} copies.`
            : `${Array.length(cardTrader.lines)} cards, ${copies} copies.`,
        ],
      ),
      h.p(
        [h.Class('text-sm text-fg-muted')],
        [
          'CardTrader wishlists keep the card and the set, not the version, so the Shop Optimizer may offer any version. Use the links beside each card to buy an exact version.',
        ],
      ),
      h.p(
        [h.Class('text-sm text-fg-muted')],
        [
          'Sending replaces the wishlist this app sent before. Changes you made to that wishlist on CardTrader are lost.',
        ],
      ),
      Array.match(cardTrader.notOnCardTrader, {
        onEmpty: () => h.empty,
        onNonEmpty: missing =>
          h.p(
            [h.Role('status'), h.Class('text-sm text-fg-muted')],
            [
              `${Array.length(missing)} printing(s) are not on CardTrader and are left out.`,
            ],
          ),
      }),
      Button.view(
        {
          content: [
            sending._tag === 'Sending' ? 'Sending…' : 'Send to CardTrader',
          ],
          onClick: Message.ClickedSend(),
          isDisabled:
            sending._tag === 'Sending' ||
            Array.isReadonlyArrayEmpty(cardTrader.lines),
        },
        h,
      ),
      WishlistState.Sending.match(sending, {
        Idle: () => h.empty,
        Sending: () => h.empty,
        Sent: ({ wishlistId, isPreviousDeleted }) =>
          h.div(
            [h.Role('status'), h.Class('flex flex-col gap-1 text-sm')],
            [
              Link.view(
                {
                  href: Wishlist.cardTraderWishlistUrl(wishlistId),
                  content: ['Open the wishlist on CardTrader'],
                },
                h,
              ),
              isPreviousDeleted
                ? h.empty
                : h.span(
                    [h.Class('text-fg-muted')],
                    [
                      'The previous wishlist could not be deleted; remove it on CardTrader.',
                    ],
                  ),
            ],
          ),
        Failed: ({ reason }) =>
          h.div(
            [
              h.Role('alert'),
              h.Class('flex flex-col gap-1 text-sm text-danger'),
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
      }),
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
  h.section(
    [h.AriaLabel('Add a card by hand'), h.Class('flex flex-col gap-2')],
    [
      SearchField.view(
        {
          id: 'wishlist-add',
          label: 'Add a card by hand',
          value: model.searchText,
          placeholder: 'Add a card by hand…',
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

const readyView = (
  model: Model,
  { context, wishlist }: ViewInputs,
  h: HtmlBuilder<Message>,
): Html => {
  const lines = linesFor(context)

  return h.div(
    [h.Class('grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]')],
    [
      h.div(
        [h.Class('flex flex-col gap-4')],
        [
          addView(model, h),
          Array.match(lines, {
            onEmpty: () =>
              Notice.view(
                {
                  title: 'Nothing to buy',
                  description: [
                    'Your decks are covered by your collection. Add cards by hand above to buy them anyway.',
                  ],
                },
                h,
              ),
            onNonEmpty: nonEmpty =>
              h.ul(
                [h.AriaLabel('Wanted cards'), h.Class('flex flex-col gap-2')],
                Array.map(nonEmpty, line => lineView(model, line, h)),
              ),
          }),
        ],
      ),
      sendView(model, lines, wishlist, h),
    ],
  )
}

export const view = Submodel.defineView<Model, Message, ViewInputs>(
  (model, inputs, h) =>
    h.section(
      [h.Class('flex flex-col gap-6')],
      [
        h.h1([h.Class('text-2xl font-semibold')], ['Wishlist']),
        Match.value(inputs).pipe(
          Match.withReturnType<Html>(),
          Match.when({ hasFailed: true }, () =>
            Notice.view(
              {
                title: 'Your wishlist could not be loaded',
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
              { title: 'Loading your wishlist…', description: [] },
              h,
            ),
          ),
        ),
      ],
    ),
)
