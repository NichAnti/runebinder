import { Array, Number, Option, Record } from 'effect'
import { Submodel } from 'foldkit'
import type { Html, HtmlBuilder } from 'foldkit/html'

import {
  Deck,
  DeckRules,
  type DeckStructure,
  Missing,
  Printing,
  Wishlist,
} from '../../../../domain'
import { deckWishlistRouter, decksRouter } from '../../../../route'
import { Button, Dialog, IconButton, Link, Notice, Toast } from '../../../../ui'
import * as CardPanel from '../../cardPanel'
import * as CollectionState from '../../collection'
import * as DecksState from '../../decks'
import { type Context, type ViewInputs, printingFinder } from './context'
import { headerView, progressView } from './headerView'
import { cardsByPrinting, nameOf } from './lines'
import { Message } from './message'
import { DELETE_DIALOG_ID, type Model } from './model'
import { sidePanelView } from './sidePanelView'
import { additionalLegendsView, zoneView } from './zoneView'

export const panelView = (
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

export const missingView = (context: Context, h: HtmlBuilder<Message>): Html =>
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

const undoView = (model: Model, h: HtmlBuilder<Message>): Html =>
  Option.match(model.maybeUndo, {
    onNone: () => h.empty,
    onSome: ({ text }) =>
      h.div(
        [
          h.Role('status'),
          h.Class(
            'fixed inset-x-4 bottom-20 z-30 mx-auto flex max-w-md items-center gap-3 rounded-card border border-border bg-surface-raised px-4 py-3 text-sm text-fg shadow-raised lg:bottom-4',
          ),
        ],
        [
          h.span([h.Class('min-w-0 flex-1')], [text]),
          Button.view(
            {
              content: ['Undo'],
              variant: 'Secondary',
              onClick: Message.ClickedUndo(),
            },
            h,
          ),
          IconButton.view(
            {
              icon: 'XMark',
              label: 'Dismiss',
              size: 'Small',
              action: { _tag: 'Click', message: Message.ClickedDismissUndo() },
            },
            h,
          ),
        ],
      ),
  })

const deleteView = (
  model: Model,
  deck: Deck.Deck,
  h: HtmlBuilder<Message>,
): Html =>
  Dialog.view(
    {
      slotId: DELETE_DIALOG_ID,
      model: model.deleteDialog,
      toParentMessage: message => Message.GotDeleteDialogMessage({ message }),
      title: `Delete “${deck.name}”?`,
      description: [
        'The deck and its CardTrader link are deleted. This cannot be undone.',
      ],
      actions: [
        Button.view(
          { content: ['Delete'], onClick: Message.ClickedConfirmDelete() },
          h,
        ),
      ],
    },
    h,
  )

export const removalFailedView = (
  removal: Option.Option<DecksState.Removal>,
  h: HtmlBuilder<Message>,
): Html =>
  Option.exists(removal, state => state === 'Failed')
    ? h.p(
        [h.Role('alert'), h.Class('text-sm text-danger')],
        ['The deck could not be deleted. Try again.'],
      )
    : h.empty

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
    removal,
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
    [h.Class('flex flex-col gap-6 pb-28 lg:pb-0')],
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
      deleteView(model, deck, h),
      undoView(model, h),
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
