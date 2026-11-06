import { Array, Option, Record, String } from 'effect'
import { Submodel } from 'foldkit'
import type { Html, HtmlBuilder } from 'foldkit/html'

import { CardTraderImport, type Printing, Wishlist } from '../../../../domain'
import { wishlistsRouter } from '../../../../route'
import type { CardTraderFailure } from '../../../../service'
import {
  Button,
  Checkbox,
  IconButton,
  Link,
  Locked,
  Notice,
  Toast,
} from '../../../../ui'
import type * as CardTraderWishlists from '../../cardTraderWishlists'
import { VARIANT_LABELS } from '../../printings'
import { nameOf } from '../deck/lines'
import { Message } from './message'
import type { Matched, Model } from './model'

export type ViewInputs = Readonly<{
  wishlistId: Wishlist.CardTraderWishlistId
  maybeDetail: Option.Option<CardTraderWishlists.Detail>
  isConnected: boolean
}>

const FAILURE_TEXT: Readonly<Record<CardTraderFailure, string>> = {
  InvalidToken: 'CardTrader rejected your token. Connect it again.',
  RateLimited: 'CardTrader is limiting requests. Wait a moment and try again.',
  Unavailable: 'CardTrader could not be reached. Try again later.',
}

const isSelected = (model: Model, key: string): boolean =>
  Option.getOrElse(Record.get(model.selected, key), () => false)

type Resolved = Readonly<{
  label: string
  maybePrinting: Option.Option<Printing.Printing>
}>

const resolve = (
  matched: Matched,
  line: CardTraderImport.ImportLine,
): Resolved => {
  if (line.match._tag !== 'Matched') {
    return { label: line.metaName, maybePrinting: Option.none() }
  }

  const { cardId, printingId } = line.match
  const maybeCard = Record.get(matched.cards, cardId)

  return {
    label: Option.match(maybeCard, {
      onNone: () => line.metaName,
      onSome: nameOf,
    }),
    maybePrinting: Option.flatMap(maybeCard, card =>
      Array.findFirst(card.printings, ({ id }) => id === printingId),
    ),
  }
}

const detailText = (
  line: CardTraderImport.ImportLine,
  maybePrinting: Option.Option<Printing.Printing>,
): string => {
  const set = String.toUpperCase(line.expansionCode)

  if (line.match._tag === 'NotInCatalogue') {
    return `${set} · not in the catalogue`
  } else if (line.match._tag === 'Ambiguous') {
    return `${set} · matches more than one card`
  } else {
    return Option.match(maybePrinting, {
      onNone: () => set,
      onSome: printing =>
        `${VARIANT_LABELS[printing.variant]} · ${printing.publicCode}`,
    })
  }
}

const lineView = (
  model: Model,
  matched: Matched,
  line: CardTraderImport.ImportLine,
  h: HtmlBuilder<Message>,
): Html => {
  const { label, maybePrinting } = resolve(matched, line)
  const isImportable = CardTraderImport.isImportable(line)

  return h.keyed('li')(
    line.key,
    [
      h.Class(
        isImportable
          ? 'flex flex-wrap items-center gap-3 rounded-card border border-border bg-surface p-3'
          : 'flex flex-wrap items-center gap-3 rounded-card border border-border bg-surface p-3 opacity-50',
      ),
    ],
    [
      Checkbox.view(
        {
          id: `import-${line.key}`,
          label: `Select ${label}`,
          isChecked: isImportable && isSelected(model, line.key),
          isDisabled: !isImportable,
          onToggle: isChecked =>
            Message.ToggledLine({ key: line.key, isChecked }),
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
            [detailText(line, maybePrinting)],
          ),
        ],
      ),
    ],
  )
}

const importView = (
  model: Model,
  matched: Matched,
  h: HtmlBuilder<Message>,
): Html => {
  const importable = Array.filter(matched.lines, CardTraderImport.isImportable)
  const selected = Array.filter(importable, ({ key }) => isSelected(model, key))

  return h.div(
    [h.Class('flex flex-col gap-3')],
    [
      h.p(
        [h.Class('text-sm text-fg-muted')],
        [
          'CardTrader keeps the card and the set, not the version, so each line is imported as the standard version of that set. Change the version in the custom wishlist afterwards.',
        ],
      ),
      Array.match(matched.lines, {
        onEmpty: () =>
          h.p([h.Class('text-sm text-fg-muted')], ['This wishlist is empty.']),
        onNonEmpty: lines =>
          h.ul(
            [h.AriaLabel('Cards'), h.Class('flex flex-col gap-2')],
            Array.map(lines, line => lineView(model, matched, line, h)),
          ),
      }),
      h.div(
        [h.Class('flex flex-wrap gap-2')],
        [
          ...Array.match(selected, {
            onEmpty: () => [],
            onNonEmpty: chosen => [
              Button.view(
                {
                  content: ['Import selected into the custom wishlist'],
                  onClick: Message.ClickedImport({
                    keys: Array.map(chosen, ({ key }) => key),
                  }),
                },
                h,
              ),
            ],
          }),
          ...Array.match(importable, {
            onEmpty: () => [],
            onNonEmpty: all => [
              Button.view(
                {
                  content: ['Import all into the custom wishlist'],
                  variant: 'Secondary',
                  onClick: Message.ClickedImport({
                    keys: Array.map(all, ({ key }) => key),
                  }),
                },
                h,
              ),
            ],
          }),
        ],
      ),
    ],
  )
}

const bodyView = (
  model: Model,
  { wishlistId, maybeDetail }: ViewInputs,
  h: HtmlBuilder<Message>,
): Html =>
  Option.match(maybeDetail, {
    onNone: () => h.empty,
    onSome: detail => {
      if (detail._tag === 'Loading') {
        return Notice.view(
          { title: 'Loading the wishlist from CardTrader…', description: [] },
          h,
        )
      } else if (detail._tag === 'Failed') {
        return Notice.view(
          {
            title: 'The wishlist could not be loaded',
            description: [FAILURE_TEXT[detail.reason]],
            variant: 'Error',
            actions: [
              Button.view(
                { content: ['Try again'], onClick: Message.ClickedRetry() },
                h,
              ),
            ],
          },
          h,
        )
      } else {
        return Option.match(
          Option.filter(
            model.maybeMatched,
            matched => matched.wishlistId === wishlistId,
          ),
          {
            onNone: () =>
              Notice.view({ title: 'Matching the cards…', description: [] }, h),
            onSome: matched => importView(model, matched, h),
          },
        )
      }
    },
  })

const titleOf = (maybeDetail: Option.Option<CardTraderWishlists.Detail>) =>
  Option.getOrElse(
    Option.flatMap(maybeDetail, detail =>
      detail._tag === 'Ready'
        ? Option.some(detail.wishlist.name)
        : Option.none(),
    ),
    () => 'CardTrader wishlist',
  )

export const view = Submodel.defineView<Model, Message, ViewInputs>(
  (model, inputs, h) => {
    const title = titleOf(inputs.maybeDetail)

    return h.section(
      [h.AriaLabel(title), h.Class('flex flex-col gap-6')],
      [
        Link.view({ href: wishlistsRouter(), content: ['← All wishlists'] }, h),
        h.div(
          [h.Class('flex flex-wrap items-center justify-between gap-3')],
          [
            h.h1([h.Class('text-2xl font-semibold')], [title]),
            IconButton.view(
              {
                icon: 'ArrowTopRightOnSquare',
                label: 'Open on CardTrader',
                action: {
                  _tag: 'External',
                  href: Wishlist.cardTraderWishlistUrl(inputs.wishlistId),
                },
              },
              h,
            ),
          ],
        ),
        Locked.view(
          {
            isLocked: !inputs.isConnected,
            unlockLabel: 'Connect CardTrader',
            onUnlock: Message.ClickedConnect(),
            content: [
              inputs.isConnected
                ? bodyView(model, inputs, h)
                : h.p(
                    [h.Class('min-h-24 text-sm text-fg-muted')],
                    ['The cards of this wishlist appear here once connected.'],
                  ),
            ],
          },
          h,
        ),
        Toast.view(
          {
            slotId: 'cardtrader-wishlist-toast',
            model: model.toast,
            toParentMessage: message => Message.GotToastMessage({ message }),
          },
          h,
        ),
      ],
    )
  },
)
