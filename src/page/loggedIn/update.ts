import { Match, Option } from 'effect'
import { Update } from 'foldkit'
import { modifyFields } from 'foldkit/struct'

import { CatalogueQuery, Printing } from '../../domain'
import type { CatalogueRoute, LoggedInRoute } from '../../route'
import type { CatalogueIndexService } from '../../service'
import { Message } from './message'
import { CatalogueState, type Model } from './model'
import * as CardPage from './page/card'
import * as CataloguePage from './page/catalogue'

type UpdateReturn = Update.Return<Model, Message, CatalogueIndexService>
const withUpdateReturn = Match.withReturnType<UpdateReturn>()

type CataloguePageEntry = Readonly<{
  query: CatalogueQuery.Query
  isIndexReady: boolean
}>

type CardPageEntry = Readonly<{
  cardId: Printing.CardId
  isIndexReady: boolean
}>

export const queryOf = ({
  _tag,
  ...query
}: CatalogueRoute): CatalogueQuery.Query => query

const readCataloguePage = (model: Model) => Option.some(model.cataloguePage)
const writeCataloguePage = (
  model: Model,
  nextCataloguePage: CataloguePage.Model,
): Model => modifyFields(model, { cataloguePage: () => nextCataloguePage })
const toCataloguePageMessage = (message: CataloguePage.Message): Message =>
  Message.GotCataloguePageMessage({ message })

const readCardPage = (model: Model) => Option.some(model.cardPage)
const writeCardPage = (model: Model, nextCardPage: CardPage.Model): Model =>
  modifyFields(model, { cardPage: () => nextCardPage })
const toCardPageMessage = (message: CardPage.Message): Message =>
  Message.GotCardPageMessage({ message })

const foldCataloguePageEntry = Update.foldChild({
  update: (page: CataloguePage.Model, entry: CataloguePageEntry) =>
    CataloguePage.enter(page, entry.query, entry.isIndexReady),
  read: readCataloguePage,
  write: writeCataloguePage,
  toParentMessage: toCataloguePageMessage,
})

const foldCataloguePage = (query: CatalogueQuery.Query) =>
  Update.foldChild({
    update: CataloguePage.update(query),
    read: readCataloguePage,
    write: writeCataloguePage,
    toParentMessage: toCataloguePageMessage,
  })

const foldCardPageEntry = Update.foldChild({
  update: (page: CardPage.Model, entry: CardPageEntry) =>
    CardPage.enter(page, entry.cardId, entry.isIndexReady),
  read: readCardPage,
  write: writeCardPage,
  toParentMessage: toCardPageMessage,
})

const foldCardPage = Update.foldChild({
  update: CardPage.update,
  read: readCardPage,
  write: writeCardPage,
  toParentMessage: toCardPageMessage,
})

// ROUTE

export const enterRoute = (
  model: Model,
  route: LoggedInRoute,
): UpdateReturn => {
  const routed = modifyFields(model, { route: () => route })
  const isIndexReady = routed.catalogue._tag === 'Ready'

  return Match.value(route).pipe(
    withUpdateReturn,
    Match.tagsExhaustive({
      Catalogue: catalogueRoute =>
        foldCataloguePageEntry(routed, {
          query: queryOf(catalogueRoute),
          isIndexReady,
        }),
      Card: ({ cardId }) => foldCardPageEntry(routed, { cardId, isIndexReady }),
      NotFound: () => ({ model: routed }),
    }),
  )
}

// UPDATE

const attemptOf = (state: CatalogueState): number =>
  CatalogueState.match(state, {
    Loading: ({ attempt }) => attempt,
    Ready: ({ attempt }) => attempt,
    Failed: ({ attempt }) => attempt,
  })

export const update = (model: Model, message: Message) =>
  Message.match<UpdateReturn>(message, {
    GotCataloguePageMessage: ({ message }) =>
      Match.value(model.route).pipe(
        withUpdateReturn,
        Match.tag('Catalogue', catalogueRoute =>
          foldCataloguePage(queryOf(catalogueRoute))(model, message),
        ),
        Match.orElse(() => ({ model })),
      ),

    GotCardPageMessage: ({ message }) => foldCardPage(model, message),

    AcquiredCatalogueIndex: ({ allValues }) =>
      enterRoute(
        modifyFields(model, {
          catalogue: catalogue =>
            CatalogueState.Ready({ attempt: attemptOf(catalogue), allValues }),
        }),
        model.route,
      ),

    ReleasedCatalogueIndex: () => ({ model }),

    FailedAcquireCatalogueIndex: () => ({
      model: modifyFields(model, {
        catalogue: catalogue =>
          CatalogueState.Failed({ attempt: attemptOf(catalogue) }),
      }),
    }),

    ClickedRetryCatalogue: () => ({
      model: modifyFields(model, {
        catalogue: catalogue =>
          CatalogueState.Loading({ attempt: attemptOf(catalogue) + 1 }),
      }),
    }),
  })
