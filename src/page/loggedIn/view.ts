import { Match } from 'effect'
import { Submodel } from 'foldkit'
import type { Html, HtmlBuilder } from 'foldkit/html'

import { catalogueHome } from '../../route'
import { Button, Notice } from '../../ui'
import * as NotFound from '../notFound'
import * as CollectionState from './collection'
import * as DecksState from './decks'
import { Message } from './message'
import { CatalogueState, type Model } from './model'
import * as CardPage from './page/card'
import * as CardTraderPage from './page/cardTrader'
import * as CataloguePage from './page/catalogue'
import * as CollectionPage from './page/collection'
import * as DeckPage from './page/deck'
import * as DeckListPage from './page/deckList'
import { contextOf } from './update'

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
      Match.value(model.route).pipe(
        Match.tagsExhaustive({
          Catalogue: catalogueRoute =>
            catalogueGate(
              model,
              ({ allValues }) =>
                h.submodel({
                  slotId: 'catalogue-page',
                  model: model.cataloguePage,
                  view: CataloguePage.view,
                  viewInputs: {
                    ...contextOf(catalogueRoute, model.collection),
                    allValues,
                    collection: model.collection,
                  },
                  toParentMessage: message =>
                    Message.GotCataloguePageMessage({ message }),
                }),
              h,
            ),
          Collection: collectionRoute =>
            catalogueGate(
              model,
              ({ allValues, printingSets }) =>
                h.div(
                  [h.Class('flex flex-col gap-8')],
                  [
                    h.h1([h.Class('text-2xl font-semibold')], ['Collection']),
                    CollectionPage.summaryView(
                      {
                        collection: model.collection,
                        printingSets,
                        onRefresh: Message.ClickedRefreshCollection(),
                      },
                      h,
                    ),
                    h.submodel({
                      slotId: 'collection-page',
                      model: model.collectionPage,
                      view: CataloguePage.view,
                      viewInputs: {
                        ...contextOf(collectionRoute, model.collection),
                        allValues,
                        collection: model.collection,
                      },
                      toParentMessage: message =>
                        Message.GotCollectionPageMessage({ message }),
                    }),
                  ],
                ),
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
                  viewInputs: { decks: model.decks, deckId },
                  toParentMessage: message =>
                    Message.GotDeckPageMessage({ message }),
                }),
              h,
            ),
          CardTrader: () =>
            h.submodel({
              slotId: 'cardtrader-page',
              model: model.cardTraderPage,
              view: CardTraderPage.view,
              toParentMessage: message =>
                Message.GotCardTraderPageMessage({ message }),
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
