import { Match, Option } from 'effect'
import { Update } from 'foldkit'
import { modifyFields } from 'foldkit/struct'

import { CatalogueQuery, Printing } from '../../domain'
import type { CatalogueRoute, LoggedInRoute } from '../../route'
import type {
  ApiClient,
  CardTraderClient,
  CatalogueIndexService,
  TokenStore,
} from '../../service'
import * as CollectionState from './collection'
import { Message } from './message'
import { CatalogueState, type Model } from './model'
import * as CardPage from './page/card'
import * as CardTraderPage from './page/cardTrader'
import * as CataloguePage from './page/catalogue'

type UpdateReturn = Update.Return<
  Model,
  Message,
  ApiClient | CatalogueIndexService | CardTraderClient | TokenStore
>
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

const readCardTraderPage = (model: Model) => Option.some(model.cardTraderPage)
const writeCardTraderPage = (
  model: Model,
  nextCardTraderPage: CardTraderPage.Model,
): Model => modifyFields(model, { cardTraderPage: () => nextCardTraderPage })
const toCardTraderPageMessage = (message: CardTraderPage.Message): Message =>
  Message.GotCardTraderPageMessage({ message })

const enterCardTraderPage = Update.foldChildStep({
  update: CardTraderPage.enter,
  read: readCardTraderPage,
  write: writeCardTraderPage,
  toParentMessage: toCardTraderPageMessage,
})

const foldCardTraderPage = Update.foldChild({
  update: CardTraderPage.update,
  read: readCardTraderPage,
  write: writeCardTraderPage,
  toParentMessage: toCardTraderPageMessage,
})

const readCollection = (model: Model) => Option.some(model.collection)
const writeCollection = (
  model: Model,
  nextCollection: CollectionState.Model,
): Model => modifyFields(model, { collection: () => nextCollection })
const toCollectionMessage = (message: CollectionState.Message): Message =>
  Message.GotCollectionMessage({ message })

const foldCollection = Update.foldChild({
  update: CollectionState.update,
  read: readCollection,
  write: writeCollection,
  toParentMessage: toCollectionMessage,
})

export const ensureCollection = Update.foldChildStep({
  update: CollectionState.ensureLoaded,
  read: readCollection,
  write: writeCollection,
  toParentMessage: toCollectionMessage,
})

export const changeQuantity = Update.foldChild({
  update: CollectionState.change,
  read: readCollection,
  write: writeCollection,
  toParentMessage: toCollectionMessage,
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
      CardTrader: () => enterCardTraderPage(routed),
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

    GotCardTraderPageMessage: ({ message }) =>
      foldCardTraderPage(model, message),

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

    GotCollectionMessage: ({ message }) => foldCollection(model, message),

    ClickedRetryCatalogue: () => ({
      model: modifyFields(model, {
        catalogue: catalogue =>
          CatalogueState.Loading({ attempt: attemptOf(catalogue) + 1 }),
      }),
    }),
  })
