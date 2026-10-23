import { Match, Option } from 'effect'
import { Update } from 'foldkit'
import { modifyFields } from 'foldkit/struct'

import { CatalogueQuery, Collection, Printing } from '../../domain'
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

type Requirements =
  | ApiClient
  | CatalogueIndexService
  | CardTraderClient
  | TokenStore
type UpdateReturn = Update.Return<Model, Message, Requirements>
const withUpdateReturn = Match.withReturnType<UpdateReturn>()

type CataloguePageEntry = Readonly<{
  query: CatalogueQuery.Query
  isIndexReady: boolean
  maybeOwned: Option.Option<Collection.Owned>
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
    CataloguePage.enter(
      page,
      entry.query,
      entry.isIndexReady,
      entry.maybeOwned,
    ),
  read: readCataloguePage,
  write: writeCataloguePage,
  toParentMessage: toCataloguePageMessage,
})

const foldCataloguePageOutMessage = CataloguePage.OutMessage.match<
  Update.Step<Model, Message, ApiClient>
>({
  SteppedQuantity: stepped => stepQuantity(stepped),
  RequestedCollectionRetry: () => refreshCollection,
})

const foldCataloguePage = (
  query: CatalogueQuery.Query,
  maybeOwned: Option.Option<Collection.Owned>,
) =>
  Update.foldChild({
    update: CataloguePage.update(query, maybeOwned),
    read: readCataloguePage,
    write: writeCataloguePage,
    toParentMessage: toCataloguePageMessage,
    foldOutMessage: foldCataloguePageOutMessage,
  })

const foldCardPageEntry = Update.foldChild({
  update: (page: CardPage.Model, entry: CardPageEntry) =>
    CardPage.enter(page, entry.cardId, entry.isIndexReady),
  read: readCardPage,
  write: writeCardPage,
  toParentMessage: toCardPageMessage,
})

const foldCardPageOutMessage = CardPage.OutMessage.match<
  Update.Step<Model, Message, ApiClient>
>({
  SteppedQuantity: stepped => stepQuantity(stepped),
  RequestedCollectionRetry: () => refreshCollection,
})

const foldCardPage = Update.foldChild({
  update: CardPage.update,
  read: readCardPage,
  write: writeCardPage,
  toParentMessage: toCardPageMessage,
  foldOutMessage: foldCardPageOutMessage,
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

const ensureCollection = Update.foldChildStep({
  update: CollectionState.ensureLoaded,
  read: readCollection,
  write: writeCollection,
  toParentMessage: toCollectionMessage,
})

const stepQuantity = Update.foldChild({
  update: CollectionState.step,
  read: readCollection,
  write: writeCollection,
  toParentMessage: toCollectionMessage,
})

const refreshCollection = Update.foldChildStep({
  update: CollectionState.refresh,
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
        Update.combine<Model, Message, ApiClient | CatalogueIndexService>(
          routed,
          [
            foldCataloguePageEntry({
              query: queryOf(catalogueRoute),
              isIndexReady,
              maybeOwned: CollectionState.maybeOwned(routed.collection),
            }),
            ensureCollection,
          ],
        ),
      Card: ({ cardId }) =>
        Update.combine<Model, Message, ApiClient | CatalogueIndexService>(
          routed,
          [foldCardPageEntry({ cardId, isIndexReady }), ensureCollection],
        ),
      CardTrader: () => enterCardTraderPage(routed),
      NotFound: () => ({ model: routed }),
    }),
  )
}

// UPDATE

const isWaitingForCollection = (route: LoggedInRoute): boolean =>
  route._tag === 'Catalogue' && route.ownership !== 'All'

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
          foldCataloguePage(
            queryOf(catalogueRoute),
            CollectionState.maybeOwned(model.collection),
          )(model, message),
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

    GotCollectionMessage: ({ message }) =>
      message._tag === 'SucceededLoadCollection' &&
      isWaitingForCollection(model.route)
        ? Update.combine<Model, Message, Requirements>(model, [
            foldCollection(message),
            stepModel => enterRoute(stepModel, stepModel.route),
          ])
        : foldCollection(model, message),

    ClickedRetryCatalogue: () => ({
      model: modifyFields(model, {
        catalogue: catalogue =>
          CatalogueState.Loading({ attempt: attemptOf(catalogue) + 1 }),
      }),
    }),
  })
