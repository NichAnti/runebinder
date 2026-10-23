import { Array, Option, pipe } from 'effect'
import { Submodel } from 'foldkit'
import type { Html, HtmlBuilder } from 'foldkit/html'

import { Collection, Missing, Printing } from '../../../../domain'
import {
  type CardRoute,
  cardRouter,
  catalogueHome,
  deckRouter,
} from '../../../../route'
import { Badge, Button, Link, Notice } from '../../../../ui'
import * as CollectionState from '../../collection'
import * as DecksState from '../../decks'
import * as Printings from '../../printings'
import * as WishlistState from '../../wishlist'
import { Message } from './message'
import { CardState, type Model } from './model'
import * as TextView from './textView'

export type ViewInputs = Readonly<{
  route: CardRoute
  collection: CollectionState.Model
  wishlist: WishlistState.Model
  decks: DecksState.Model
}>

const selectedPrinting = (
  card: Printing.Card,
  maybePrintingId: Option.Option<Printing.PrintingId>,
): Printing.Printing =>
  pipe(
    maybePrintingId,
    Option.flatMap(id =>
      Array.findFirst(card.printings, printing => printing.id === id),
    ),
    Option.getOrElse(() => Printing.basePrinting(card)),
  )

const statView = <M>(
  label: string,
  maybeValue: Option.Option<number>,
  h: HtmlBuilder<M>,
): Html =>
  Option.match(maybeValue, {
    onNone: () => h.empty,
    onSome: value =>
      h.div(
        [h.Class('flex flex-col')],
        [
          h.dt([h.Class('text-xs text-fg-muted')], [label]),
          h.dd([h.Class('text-lg font-semibold tabular-nums')], [`${value}`]),
        ],
      ),
  })

const detailsView = <M>(printing: Printing.Printing, h: HtmlBuilder<M>): Html =>
  h.div(
    [h.Class('flex flex-col gap-4')],
    [
      h.div(
        [h.Class('flex flex-col gap-1')],
        [
          h.h1(
            [h.Class('text-2xl font-semibold')],
            [
              printing.name,
              ...Option.match(printing.maybeSubtitle, {
                onNone: () => [],
                onSome: subtitle => [
                  h.span([h.Class('text-fg-muted')], [` · ${subtitle}`]),
                ],
              }),
            ],
          ),
          h.p(
            [h.Class('text-sm text-fg-muted')],
            [
              Array.join(
                [...Option.toArray(printing.maybeType), ...printing.supertypes],
                ' · ',
              ),
            ],
          ),
        ],
      ),
      h.div(
        [h.Class('flex flex-wrap gap-1.5')],
        Array.map(printing.domains, domain =>
          Badge.view({ content: [domain], tone: domain }, h),
        ),
      ),
      h.dl(
        [h.Class('flex flex-wrap gap-6')],
        [
          statView('Energy', printing.maybeEnergy, h),
          statView('Might', printing.maybeMight, h),
          statView('Might bonus', printing.maybeMightBonus, h),
          statView('Power', printing.maybePower, h),
        ],
      ),
      Option.match(printing.maybeText, {
        onNone: () => h.empty,
        onSome: html => TextView.view(html, h),
      }),
      Option.match(printing.maybeEffect, {
        onNone: () => h.empty,
        onSome: html =>
          h.div(
            [h.Class('flex flex-col gap-1')],
            [
              h.h2([h.Class('text-sm font-medium')], ['Effect']),
              TextView.view(html, h),
            ],
          ),
      }),
      Array.match(printing.tags, {
        onEmpty: () => h.empty,
        onNonEmpty: tags =>
          h.p(
            [h.Class('text-sm text-fg-muted')],
            [`Tags: ${Array.join(tags, ', ')}`],
          ),
      }),
      Array.match(printing.artists, {
        onEmpty: () => h.empty,
        onNonEmpty: artists =>
          h.p(
            [h.Class('text-sm text-fg-muted')],
            [`Artist: ${Array.join(artists, ', ')}`],
          ),
      }),
    ],
  )

const wishlistView = (
  printing: Printing.Printing,
  wishlist: WishlistState.Model,
  h: HtmlBuilder<Message>,
): Html =>
  Option.match(WishlistState.maybeAdded(wishlist), {
    onNone: () => h.empty,
    onSome: added => {
      const wanted = Collection.quantityOf(added, printing.id)

      return h.div(
        [h.Class('flex flex-wrap items-center gap-3')],
        [
          Button.view(
            {
              content: ['Add to wishlist'],
              variant: 'Secondary',
              onClick: Message.ClickedAddToWishlist({
                printingId: printing.id,
              }),
            },
            h,
          ),
          wanted === 0
            ? h.empty
            : h.span(
                [h.Role('status'), h.Class('text-sm text-fg-muted')],
                [`In your custom wishlist: ${wanted}`],
              ),
        ],
      )
    },
  })

const usedInView = (
  card: Printing.Card,
  decks: DecksState.Model,
  h: HtmlBuilder<Message>,
): Html =>
  DecksState.Model.match(decks, {
    NotLoaded: () => h.empty,
    Loading: () => h.empty,
    Failed: () => h.empty,
    Ready: ({ decks: all }) =>
      h.section(
        [h.AriaLabel('Used in decks'), h.Class('flex flex-col gap-2')],
        [
          h.h2([h.Class('text-sm font-medium')], ['Used in decks']),
          Array.match(
            Missing.decksUsing(
              all,
              Array.map(card.printings, ({ id }) => id),
            ),
            {
              onEmpty: () =>
                h.p(
                  [h.Class('text-sm text-fg-muted')],
                  ['None of your decks.'],
                ),
              onNonEmpty: uses =>
                h.ul(
                  [h.Class('flex flex-col gap-1')],
                  Array.map(uses, ({ deck, copies }) =>
                    h.keyed('li')(
                      deck.id,
                      [h.Class('flex items-center gap-2 text-sm')],
                      [
                        Link.view(
                          {
                            href: deckRouter({ deckId: deck.id }),
                            content: [deck.name],
                          },
                          h,
                        ),
                        h.span(
                          [h.Class('text-fg-muted tabular-nums')],
                          [`×${copies}`],
                        ),
                      ],
                    ),
                  ),
                ),
            },
          ),
        ],
      ),
  })

const foundView = (
  card: Printing.Card,
  { route, collection, wishlist, decks }: ViewInputs,
  h: HtmlBuilder<Message>,
): Html => {
  const printing = selectedPrinting(card, route.printing)

  return h.article(
    [h.Class('flex flex-col gap-6')],
    [
      Link.view({ href: catalogueHome(), content: ['← Catalogue'] }, h),
      h.div(
        [h.Class('grid gap-8 md:grid-cols-[minmax(0,22rem)_1fr]')],
        [
          h.img([
            h.Src(printing.imageUrl),
            h.Alt(
              Option.getOrElse(
                printing.maybeAccessibilityText,
                () => printing.name,
              ),
            ),
            h.Class(
              `w-full rounded-card bg-surface-raised shadow-raised ${printing.orientation === 'Landscape' ? 'aspect-[1039/744]' : 'aspect-[744/1039]'}`,
            ),
          ]),
          h.div(
            [h.Class('flex flex-col gap-6')],
            [
              detailsView(printing, h),
              wishlistView(printing, wishlist, h),
              usedInView(card, decks, h),
            ],
          ),
        ],
      ),
      Printings.printingsView(
        {
          card,
          counts: CollectionState.countsOf(collection),
          selected: printing.id,
          hrefFor: ({ id }) =>
            cardRouter({ cardId: card.id, printing: Option.some(id) }),
          onStep: (printingId, step) =>
            Message.ClickedStepQuantity({ printingId, step }),
          onRetry: Message.ClickedRetryCollection(),
          isShowingImages: true,
          isLinkingCardTrader: true,
        },
        h,
      ),
    ],
  )
}

export const view = Submodel.defineView<Model, Message, ViewInputs>(
  (model, viewInputs, h) =>
    CardState.match(model.state, {
      Waiting: () =>
        Notice.view(
          { title: 'Loading card…', description: ['One moment.'] },
          h,
        ),
      Missing: () =>
        Notice.view(
          {
            title: 'Card not found',
            description: [
              'There is no card at this address. ',
              Link.view(
                { href: catalogueHome(), content: ['Back to the catalogue'] },
                h,
              ),
            ],
          },
          h,
        ),
      Found: ({ card }) => foundView(card, viewInputs, h),
    }),
)
