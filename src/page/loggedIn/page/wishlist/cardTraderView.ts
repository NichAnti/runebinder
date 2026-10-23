import { Array, Option } from 'effect'
import type { Html, HtmlBuilder } from 'foldkit/html'

import { Wishlist } from '../../../../domain'
import { cardTraderWishlistRouter } from '../../../../route'
import type { CardTraderFailure, ListedWishlist } from '../../../../service'
import { Badge, Button, Dialog, IconButton, Link, Locked } from '../../../../ui'
import * as CardTraderWishlists from '../../cardTraderWishlists'
import * as WishlistState from '../../wishlist'
import { Message } from './message'
import { CONFIRM_DIALOG_ID, type Model, Pending } from './model'
import type { Section } from './sections'
import { cardTraderLinesOf } from './update'

export type CardTraderInputs = Readonly<{
  wishlist: WishlistState.Model
  remote: CardTraderWishlists.Model
  isConnected: boolean
}>

const CONNECT_LABEL = 'Connect CardTrader'

const FAILURE_TEXT: Readonly<Record<WishlistState.Failure, string>> = {
  NotConnected: 'Connect your CardTrader account first.',
  InvalidToken: 'CardTrader rejected your token. Connect it again.',
  RateLimited: 'CardTrader is limiting requests. Wait a moment and try again.',
  Unavailable: 'CardTrader could not be reached. Try again later.',
  NotSaved:
    'The wishlist was created on CardTrader but could not be saved here. It is listed under “On CardTrader”.',
}

const REMOTE_FAILURE_TEXT: Readonly<Record<CardTraderFailure, string>> = {
  InvalidToken: FAILURE_TEXT.InvalidToken,
  RateLimited: FAILURE_TEXT.RateLimited,
  Unavailable: FAILURE_TEXT.Unavailable,
}

const WORKING_TEXT: Readonly<Record<WishlistState.Action, string>> = {
  Create: 'Creating on CardTrader…',
  Sync: 'Syncing on CardTrader…',
  Delete: 'Deleting on CardTrader…',
}

// STATUS

const isListedOn = (
  remote: CardTraderWishlists.Model,
  wishlistId: Wishlist.CardTraderWishlistId,
): Option.Option<boolean> =>
  remote.listing._tag === 'Ready'
    ? Option.some(
        Array.some(remote.listing.wishlists, ({ id }) => id === wishlistId),
      )
    : Option.none()

const statusText = (
  section: Section,
  { wishlist, remote }: CardTraderInputs,
): string =>
  Option.match(WishlistState.linkOf(wishlist, section.wishlist), {
    onNone: () => 'Not on CardTrader',
    onSome: wishlistId =>
      Option.getOrElse(isListedOn(remote, wishlistId), () => true)
        ? 'On CardTrader'
        : 'No longer on CardTrader',
  })

export const statusView = (
  section: Section,
  inputs: CardTraderInputs,
  h: HtmlBuilder<Message>,
): Html =>
  h.span(
    [h.Class('text-sm text-fg-muted')],
    [
      Option.match(
        WishlistState.operationOf(inputs.wishlist, section.wishlist),
        {
          onNone: () => statusText(section, inputs),
          onSome: operation =>
            operation._tag === 'Working'
              ? WORKING_TEXT[operation.action]
              : statusText(section, inputs),
        },
      ),
    ],
  )

export const failureView = (
  section: Section,
  { wishlist }: CardTraderInputs,
  h: HtmlBuilder<Message>,
): Html =>
  Option.match(WishlistState.operationOf(wishlist, section.wishlist), {
    onNone: () => h.empty,
    onSome: operation =>
      operation._tag === 'Failed'
        ? h.p(
            [h.Role('alert'), h.Class('text-sm text-danger')],
            [FAILURE_TEXT[operation.reason]],
          )
        : h.empty,
  })

// ACTIONS

export const actionsView = (
  model: Model,
  section: Section,
  inputs: CardTraderInputs,
  h: HtmlBuilder<Message>,
): Html => {
  const maybeLink = WishlistState.linkOf(inputs.wishlist, section.wishlist)
  const isWorking = Option.exists(
    WishlistState.operationOf(inputs.wishlist, section.wishlist),
    operation => operation._tag === 'Working',
  )
  const hasLines = Array.isReadonlyArrayNonEmpty(
    cardTraderLinesOf(model, section).lines,
  )

  return h.div(
    [h.Class('flex items-center gap-2')],
    [
      ...Option.match(maybeLink, {
        onNone: () => [],
        onSome: wishlistId => [
          IconButton.view(
            {
              icon: 'ArrowTopRightOnSquare',
              label: `Open ${section.title} on CardTrader`,
              action: {
                _tag: 'External',
                href: Wishlist.cardTraderWishlistUrl(wishlistId),
              },
            },
            h,
          ),
        ],
      }),
      Locked.view(
        {
          isLocked: !inputs.isConnected,
          unlockLabel: CONNECT_LABEL,
          onUnlock: Message.ClickedConnect(),
          variant: 'Inline',
          content: [
            h.div(
              [h.Class('flex items-center gap-2')],
              Option.match(maybeLink, {
                onNone: () => [
                  IconButton.view(
                    {
                      icon: 'CloudArrowUp',
                      label: `Create ${section.title} on CardTrader`,
                      action: {
                        _tag: 'Click',
                        message: Message.ClickedCreate({
                          wishlist: section.wishlist,
                        }),
                      },
                      isDisabled: isWorking || !hasLines,
                    },
                    h,
                  ),
                ],
                onSome: () => [
                  IconButton.view(
                    {
                      icon: 'ArrowPath',
                      label: `Sync ${section.title} on CardTrader`,
                      action: {
                        _tag: 'Click',
                        message: Message.ClickedSync({
                          wishlist: section.wishlist,
                        }),
                      },
                      isDisabled: isWorking || !hasLines,
                    },
                    h,
                  ),
                  IconButton.view(
                    {
                      icon: 'Trash',
                      label: `Delete ${section.title} on CardTrader`,
                      variant: 'Danger',
                      action: {
                        _tag: 'Click',
                        message: Message.ClickedDelete({
                          wishlist: section.wishlist,
                        }),
                      },
                      isDisabled: isWorking,
                    },
                    h,
                  ),
                ],
              }),
            ),
          ],
        },
        h,
      ),
    ],
  )
}

// ON CARDTRADER

const remoteRowView = (
  listed: ListedWishlist,
  remote: CardTraderWishlists.Model,
  h: HtmlBuilder<Message>,
): Html => {
  const maybeDeletion = CardTraderWishlists.deletionOf(remote, listed.id)
  const isDeleting = Option.exists(
    maybeDeletion,
    deletion => deletion._tag === 'Deleting',
  )

  return h.keyed('li')(
    `${listed.id}`,
    [
      h.Class(
        'flex flex-wrap items-center gap-3 rounded-card border border-border bg-surface p-3',
      ),
    ],
    [
      h.div(
        [h.Class('flex min-w-48 flex-1 flex-wrap items-center gap-2')],
        [
          Link.view(
            {
              href: cardTraderWishlistRouter({ wishlistId: listed.id }),
              content: [listed.name],
            },
            h,
          ),
          Wishlist.isNamedByApp(listed.name)
            ? Badge.view({ content: ['Made by this app'] }, h)
            : h.empty,
        ],
      ),
      ...Option.match(maybeDeletion, {
        onNone: () => [],
        onSome: deletion =>
          deletion._tag === 'Failed'
            ? [
                h.span(
                  [h.Role('alert'), h.Class('text-sm text-danger')],
                  [REMOTE_FAILURE_TEXT[deletion.reason]],
                ),
              ]
            : [h.span([h.Class('text-sm text-fg-muted')], ['Deleting…'])],
      }),
      IconButton.view(
        {
          icon: 'ArrowTopRightOnSquare',
          label: `Open ${listed.name} on CardTrader`,
          action: {
            _tag: 'External',
            href: Wishlist.cardTraderWishlistUrl(listed.id),
          },
        },
        h,
      ),
      IconButton.view(
        {
          icon: 'Trash',
          label: `Delete ${listed.name} on CardTrader`,
          variant: 'Danger',
          action: {
            _tag: 'Click',
            message: Message.ClickedDeleteRemote({
              wishlistId: listed.id,
              name: listed.name,
            }),
          },
          isDisabled: isDeleting,
        },
        h,
      ),
    ],
  )
}

const remoteListView = (
  remote: CardTraderWishlists.Model,
  linkedIds: ReadonlyArray<Wishlist.CardTraderWishlistId>,
  h: HtmlBuilder<Message>,
): Html =>
  CardTraderWishlists.Listing.match(remote.listing, {
    NotLoaded: () =>
      h.p([h.Class('text-sm text-fg-muted')], ['Not loaded yet.']),
    Loading: () =>
      h.p(
        [h.Role('status'), h.Class('text-sm text-fg-muted')],
        ['Loading your CardTrader wishlists…'],
      ),
    Failed: ({ reason }) =>
      h.p(
        [h.Role('alert'), h.Class('text-sm text-danger')],
        [REMOTE_FAILURE_TEXT[reason]],
      ),
    Ready: ({ wishlists }) =>
      Array.match(
        Array.filter(wishlists, ({ id }) => !Array.contains(linkedIds, id)),
        {
          onEmpty: () =>
            h.p(
              [h.Class('text-sm text-fg-muted')],
              ['No other Riftbound wishlists on CardTrader.'],
            ),
          onNonEmpty: others =>
            h.ul(
              [
                h.AriaLabel('Wishlists on CardTrader'),
                h.Class('flex flex-col gap-2'),
              ],
              Array.map(others, listed => remoteRowView(listed, remote, h)),
            ),
        },
      ),
  })

export const onCardTraderView = (
  sections: ReadonlyArray<Section>,
  inputs: CardTraderInputs,
  h: HtmlBuilder<Message>,
): Html => {
  const linkedIds = Array.getSomes(
    Array.map(sections, section =>
      WishlistState.linkOf(inputs.wishlist, section.wishlist),
    ),
  )

  return h.section(
    [h.AriaLabel('On CardTrader'), h.Class('flex flex-col gap-3')],
    [
      h.div(
        [h.Class('flex flex-wrap items-center justify-between gap-3')],
        [
          h.div(
            [h.Class('flex flex-col gap-1')],
            [
              h.h2([h.Class('text-lg font-semibold')], ['On CardTrader']),
              h.p(
                [h.Class('text-sm text-fg-muted')],
                [
                  'Your other Riftbound wishlists on CardTrader. Open one to import its cards into the custom wishlist.',
                ],
              ),
            ],
          ),
          inputs.isConnected
            ? IconButton.view(
                {
                  icon: 'ArrowPath',
                  label: 'Refresh from CardTrader',
                  action: {
                    _tag: 'Click',
                    message: Message.ClickedRefreshRemote(),
                  },
                  isDisabled: inputs.remote.listing._tag === 'Loading',
                },
                h,
              )
            : h.empty,
        ],
      ),
      Locked.view(
        {
          isLocked: !inputs.isConnected,
          unlockLabel: CONNECT_LABEL,
          onUnlock: Message.ClickedConnect(),
          content: [
            inputs.isConnected
              ? remoteListView(inputs.remote, linkedIds, h)
              : h.p(
                  [h.Class('min-h-24 text-sm text-fg-muted')],
                  ['Your CardTrader wishlists appear here once connected.'],
                ),
          ],
        },
        h,
      ),
    ],
  )
}

// CONFIRM

const confirmTextOf = (
  pending: Pending,
): Readonly<{ title: string; description: string; action: string }> =>
  Pending.match(pending, {
    Sync: ({ title }) => ({
      title: `Sync “${title}” on CardTrader?`,
      description:
        'CardTrader cannot update a wishlist, so a new one is created with the current cards and the old one is deleted. Changes made to it on CardTrader are lost.',
      action: 'Sync',
    }),
    DeleteLinked: ({ title }) => ({
      title: `Delete “${title}” on CardTrader?`,
      description:
        'The wishlist is deleted on CardTrader. It stays in this app and can be created again.',
      action: 'Delete',
    }),
    DeleteRemote: ({ name }) => ({
      title: `Delete “${name}” on CardTrader?`,
      description:
        'The wishlist is deleted on CardTrader. This cannot be undone.',
      action: 'Delete',
    }),
  })

export const confirmView = (model: Model, h: HtmlBuilder<Message>): Html => {
  const text = Option.match(model.maybePending, {
    onNone: () => ({ title: '', description: '', action: '' }),
    onSome: confirmTextOf,
  })

  return Dialog.view(
    {
      slotId: CONFIRM_DIALOG_ID,
      model: model.confirmDialog,
      toParentMessage: message => Message.GotConfirmDialogMessage({ message }),
      title: text.title,
      description: [text.description],
      actions: [
        Button.view(
          { content: [text.action], onClick: Message.ClickedConfirm() },
          h,
        ),
      ],
    },
    h,
  )
}
