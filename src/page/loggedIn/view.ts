import { Match } from 'effect'
import { Submodel } from 'foldkit'
import type { Html, HtmlBuilder } from 'foldkit/html'

import { CatalogueSearch } from '../../domain'
import { catalogueHome } from '../../route'
import { Button, Notice } from '../../ui'
import * as NotFound from '../notFound'
import { Message } from './message'
import { CatalogueState, type Model } from './model'
import * as CardPage from './page/card'
import * as CataloguePage from './page/catalogue'
import { queryOf } from './update'

const catalogueGate = (
  model: Model,
  whenReady: (allValues: CatalogueSearch.Facets) => Html,
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
    Ready: ({ allValues }) => whenReady(allValues),
  })

export const view = Submodel.defineView<Model, Message>((model, h) =>
  h.main(
    [h.Class('mx-auto flex w-full max-w-7xl flex-col px-4 py-8')],
    [
      Match.value(model.route).pipe(
        Match.tagsExhaustive({
          Catalogue: catalogueRoute =>
            catalogueGate(
              model,
              allValues =>
                h.submodel({
                  slotId: 'catalogue-page',
                  model: model.cataloguePage,
                  view: CataloguePage.view,
                  viewInputs: { query: queryOf(catalogueRoute), allValues },
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
                  viewInputs: { route: cardRoute },
                  toParentMessage: message =>
                    Message.GotCardPageMessage({ message }),
                }),
              h,
            ),
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
