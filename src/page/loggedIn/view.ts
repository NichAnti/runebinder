import { Match, Option } from 'effect'
import { Submodel } from 'foldkit'
import type { Html, HtmlBuilder } from 'foldkit/html'

import { Wishlist } from '../../domain'
import { catalogueHome } from '../../route'
import { Button, Notice } from '../../ui'
import * as NotFound from '../notFound'
import * as CardTraderState from './cardTrader'
import * as CardTraderWishlists from './cardTraderWishlists'
import * as CollectionState from './collection'
import * as DecksState from './decks'
import { Message } from './message'
import { CatalogueState, type Model } from './model'
import * as CardPage from './page/card'
import * as CardTraderPage from './page/cardTrader'
import * as CardTraderWishlistPage from './page/cardTraderWishlist'
import * as CataloguePage from './page/catalogue'
import * as DeckPage from './page/deck'
import * as DeckListPage from './page/deckList'
import * as WishlistPage from './page/wishlist'
import { wantedOf, wishlistContextOf } from './update'
import * as WishlistState from './wishlist'

const catalogueGate = (
  model: Model,
  whenReady: (ready: typeof CatalogueState.Ready.Type) => Html,
  h: HtmlBuilder<Message>,
): Html =>
  CatalogueState.match(model.catalogue, {
    Loading: () =>
      Notice.view(
        {
          title: 'Loading the catalogue…',
          description: ['This happens once per visit.'],
        },
        h,
      ),
    Failed: () =>
      Notice.view(
        {
          title: 'The catalogue could not be loaded',
          description: ['Check your connection and try again.'],
          variant: 'Error',
          actions: [
            Button.view(
              {
                content: ['Try again'],
                onClick: Message.ClickedRetryCatalogue(),
              },
              h,
            ),
          ],
        },
        h,
      ),
    Ready: whenReady,
  })

const wishlistPageView = (
  model: Model,
  focus: WishlistPage.Focus,
  h: HtmlBuilder<Message>,
): Html =>
  catalogueGate(
    model,
    () =>
      h.submodel({
        slotId: 'wishlist-page',
        model: model.wishlistPage,
        view: WishlistPage.view,
        viewInputs: {
          focus,
          isReady: Option.isSome(wishlistContextOf(model)),
          hasFailed:
            model.decks._tag === 'Failed' ||
            model.collection._tag === 'Failed' ||
            model.wishlist._tag === 'Failed',
          context: Option.getOrElse(
            wishlistContextOf(model),
            (): WishlistPage.Context => ({ decks: [], owned: {}, added: {} }),
          ),
          wishlist: model.wishlist,
          remote: model.cardTraderWishlists,
          isConnected: CardTraderState.isConnected(model.cardTrader),
        },
        toParentMessage: message => Message.GotWishlistPageMessage({ message }),
      }),
    h,
  )

export const view = Submodel.defineView<Model, Message>((model, h) =>
  h.main(
    [h.Class('mx-auto flex w-full max-w-7xl flex-col px-4 py-8')],
    [
      h.submodel({
        slotId: 'collection-status',
        model: model.collection,
        view: CollectionState.view,
        toParentMessage: message => Message.GotCollectionMessage({ message }),
      }),
      h.submodel({
        slotId: 'decks-status',
        model: model.decks,
        view: DecksState.view,
        toParentMessage: message => Message.GotDecksMessage({ message }),
      }),
      h.submodel({
        slotId: 'cardtrader-connect',
        model: model.cardTrader,
        view: CardTraderState.view,
        toParentMessage: message => Message.GotCardTraderMessage({ message }),
      }),
      h.submodel({
        slotId: 'wishlist-status',
        model: model.wishlist,
        view: WishlistState.view,
        toParentMessage: message => Message.GotWishlistMessage({ message }),
      }),
      Match.value(model.route).pipe(
        Match.tagsExhaustive({
          Catalogue: ({ _tag, ...query }) =>
            catalogueGate(
              model,
              ({ allValues, printingSets }) =>
                h.submodel({
                  slotId: 'catalogue-page',
                  model: model.cataloguePage,
                  view: CataloguePage.view,
                  viewInputs: {
                    query,
                    allValues,
                    printingSets,
                    collection: model.collection,
                    maybeWanted: wantedOf(model),
                  },
                  toParentMessage: message =>
                    Message.GotCataloguePageMessage({ message }),
                }),
              h,
            ),
          Card: cardRoute =>
            catalogueGate(
              model,
              () =>
                h.submodel({
                  slotId: 'card-page',
                  model: model.cardPage,
                  view: CardPage.view,
                  viewInputs: {
                    route: cardRoute,
                    collection: model.collection,
                    wishlist: model.wishlist,
                    decks: model.decks,
                  },
                  toParentMessage: message =>
                    Message.GotCardPageMessage({ message }),
                }),
              h,
            ),
          Decks: () =>
            h.submodel({
              slotId: 'deck-list-page',
              model: model.deckListPage,
              view: DeckListPage.view,
              viewInputs: { decks: model.decks },
              toParentMessage: message =>
                Message.GotDeckListPageMessage({ message }),
            }),
          Deck: ({ deckId }) =>
            catalogueGate(
              model,
              () =>
                h.submodel({
                  slotId: 'deck-page',
                  model: model.deckPage,
                  view: DeckPage.view,
                  viewInputs: {
                    decks: model.decks,
                    deckId,
                    collection: model.collection,
                  },
                  toParentMessage: message =>
                    Message.GotDeckPageMessage({ message }),
                }),
              h,
            ),
          Wishlists: () => wishlistPageView(model, { _tag: 'All' }, h),
          CustomWishlist: () =>
            wishlistPageView(
              model,
              { _tag: 'One', wishlist: Wishlist.CUSTOM },
              h,
            ),
          DeckWishlist: ({ deckId }) =>
            wishlistPageView(
              model,
              { _tag: 'One', wishlist: Wishlist.deckWishlist(deckId) },
              h,
            ),
          CardTraderWishlist: ({ wishlistId }) =>
            h.submodel({
              slotId: 'cardtrader-wishlist-page',
              model: model.cardTraderWishlistPage,
              view: CardTraderWishlistPage.view,
              viewInputs: {
                wishlistId,
                maybeDetail: CardTraderWishlists.detailOf(
                  model.cardTraderWishlists,
                  wishlistId,
                ),
                isConnected: CardTraderState.isConnected(model.cardTrader),
              },
              toParentMessage: message =>
                Message.GotCardTraderWishlistPageMessage({ message }),
            }),
          CardTrader: () =>
            h.submodel({
              slotId: 'cardtrader-page',
              model: model.cardTrader,
              view: CardTraderPage.view,
              toParentMessage: message =>
                Message.GotCardTraderMessage({ message }),
            }),
          NotFound: ({ path }) =>
            NotFound.view(
              {
                path,
                backHref: catalogueHome(),
                backLabel: 'Go to catalogue',
              },
              h,
            ),
        }),
      ),
    ],
  ),
)
