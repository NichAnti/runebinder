import { Match, Option } from 'effect'
import { Update } from 'foldkit'
import { modifyFields } from 'foldkit/struct'

import { Printing } from '../../domain'
import type {
  CatalogueRoute,
  CollectionRoute,
  LoggedInRoute,
} from '../../route'
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
  context: CataloguePage.Context
  isIndexReady: boolean
}>

type CardPageEntry = Readonly<{
  cardId: Printing.CardId
  isIndexReady: boolean
}>

export const contextOf = (
  { _tag, ...query }: CatalogueRoute | CollectionRoute,
  collection: CollectionState.Model,
): CataloguePage.Context => {
  const maybeOwned = CollectionState.maybeOwned(collection)

  return _tag === 'Collection'
    ? { scope: 'Collection', query: { ...query, ownership: 'All' }, maybeOwned }
    : { scope: 'Catalogue', query, maybeOwned }
}

type CataloguePageSlot = Readonly<{
  read: (model: Model) => Option.Option<CataloguePage.Model>
  write: (model: Model, nextPage: CataloguePage.Model) => Model
  toParentMessage: (message: CataloguePage.Message) => Message
}>

const CATALOGUE_PAGE_SLOTS: Readonly<
  Record<CataloguePage.Scope, CataloguePageSlot>
> = {
  Catalogue: {
    read: model => Option.some(model.cataloguePage),
    write: (model, nextPage) =>
      modifyFields(model, { cataloguePage: () => nextPage }),
    toParentMessage: message => Message.GotCataloguePageMessage({ message }),
  },
  Collection: {
    read: model => Option.some(model.collectionPage),
    write: (model, nextPage) =>
      modifyFields(model, { collectionPage: () => nextPage }),
    toParentMessage: message => Message.GotCollectionPageMessage({ message }),
  },
}

const readCardPage = (model: Model) => Option.some(model.cardPage)
const writeCardPage = (model: Model, nextCardPage: CardPage.Model): Model =>
  modifyFields(model, { cardPage: () => nextCardPage })
const toCardPageMessage = (message: CardPage.Message): Message =>
  Message.GotCardPageMessage({ message })

const foldCataloguePageEntry = (entry: CataloguePageEntry) =>
  Update.foldChild({
    update: (
      page: CataloguePage.Model,
      { context, isIndexReady }: CataloguePageEntry,
    ) => CataloguePage.enter(page, context, isIndexReady),
    ...CATALOGUE_PAGE_SLOTS[entry.context.scope],
  })(entry)

const foldCataloguePageOutMessage = CataloguePage.OutMessage.match<
  Update.Step<Model, Message, ApiClient>
>({
  SteppedQuantity: stepped => stepQuantity(stepped),
  RequestedCollectionRetry: () => refreshCollection,
})

const foldCataloguePage = (context: CataloguePage.Context) =>
  Update.foldChild({
    update: CataloguePage.update(context),
    ...CATALOGUE_PAGE_SLOTS[context.scope],
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
              context: contextOf(catalogueRoute, routed.collection),
              isIndexReady,
            }),
            ensureCollection,
          ],
        ),
      Collection: collectionRoute =>
        Update.combine<Model, Message, ApiClient | CatalogueIndexService>(
          routed,
          [
            foldCataloguePageEntry({
              context: contextOf(collectionRoute, routed.collection),
              isIndexReady,
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
  route._tag === 'Collection' ||
  (route._tag === 'Catalogue' && route.ownership !== 'All')

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
          foldCataloguePage(contextOf(catalogueRoute, model.collection))(
            model,
            message,
          ),
        ),
        Match.orElse(() => ({ model })),
      ),

    GotCollectionPageMessage: ({ message }) =>
      Match.value(model.route).pipe(
        withUpdateReturn,
        Match.tag('Collection', collectionRoute =>
          foldCataloguePage(contextOf(collectionRoute, model.collection))(
            model,
            message,
          ),
        ),
        Match.orElse(() => ({ model })),
      ),

    ClickedRefreshCollection: () => refreshCollection(model),

    GotCardPageMessage: ({ message }) => foldCardPage(model, message),

    GotCardTraderPageMessage: ({ message }) =>
      foldCardTraderPage(model, message),

    AcquiredCatalogueIndex: ({ allValues, printingSets }) =>
      enterRoute(
        modifyFields(model, {
          catalogue: catalogue =>
            CatalogueState.Ready({
              attempt: attemptOf(catalogue),
              allValues,
              printingSets,
            }),
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
