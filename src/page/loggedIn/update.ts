import { Effect, Match, Option } from 'effect'
import { Command, Update } from 'foldkit'
import { pushUrl, replaceUrl } from 'foldkit/navigation'
import { modifyFields } from 'foldkit/struct'

import { Deck, Printing } from '../../domain'
import {
  type CatalogueRoute,
  type CollectionRoute,
  type LoggedInRoute,
  deckRouter,
  decksRouter,
} from '../../route'
import type {
  ApiClient,
  CardTraderClient,
  CatalogueIndexService,
  TokenStore,
} from '../../service'
import * as CollectionState from './collection'
import * as DecksState from './decks'
import { Message } from './message'
import { CatalogueState, type Model } from './model'
import * as CardPage from './page/card'
import * as CardTraderPage from './page/cardTrader'
import * as CataloguePage from './page/catalogue'
import * as DeckPage from './page/deck'
import * as DeckListPage from './page/deckList'

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

// COMMAND

export const OpenDeck = Command.define('OpenDeck', {
  args: { deckId: Deck.DeckId },
  messages: [Message.CompletedOpenDeck],
  execute: ({ deckId }) =>
    pushUrl(deckRouter({ deckId })).pipe(
      Effect.as(Message.CompletedOpenDeck()),
    ),
})

export const ReturnToDecks = Command.define('ReturnToDecks', {
  messages: [Message.CompletedReturnToDecks],
  execute: replaceUrl(decksRouter()).pipe(
    Effect.as(Message.CompletedReturnToDecks()),
  ),
})

// DECKS

const readDecks = (model: Model) => Option.some(model.decks)
const writeDecks = (model: Model, nextDecks: DecksState.Model): Model =>
  modifyFields(model, { decks: () => nextDecks })
const toDecksMessage = (message: DecksState.Message): Message =>
  Message.GotDecksMessage({ message })

const foldDecksOutMessage = DecksState.OutMessage.match<
  Update.Step<Model, Message, ApiClient>
>({
  CreatedDeck:
    ({ deckId }) =>
    stepModel => ({
      model: stepModel,
      commands: [OpenDeck({ deckId })],
    }),
  RemovedDeck: () => stepModel => ({
    model: stepModel,
    commands: [ReturnToDecks()],
  }),
})

const decksFold = {
  read: readDecks,
  write: writeDecks,
  toParentMessage: toDecksMessage,
  foldOutMessage: foldDecksOutMessage,
}

const foldDecks = Update.foldChild({ update: DecksState.update, ...decksFold })
const ensureDecks = Update.foldChildStep({
  update: DecksState.ensureLoaded,
  ...decksFold,
})
const retryDecks = Update.foldChildStep({
  update: DecksState.retry,
  ...decksFold,
})
const createDeck = Update.foldChild({ update: DecksState.create, ...decksFold })
const editDeck = Update.foldChild({ update: DecksState.edit, ...decksFold })
const removeDeck = Update.foldChild({ update: DecksState.remove, ...decksFold })

const foldDeckListPageOutMessage = DeckListPage.OutMessage.match<
  Update.Step<Model, Message, ApiClient>
>({
  RequestedCreateDeck: newDeck => createDeck(newDeck),
  RequestedRetryLoadDecks: () => retryDecks,
})

const foldDeckListPage = Update.foldChild({
  update: DeckListPage.update,
  read: (model: Model) => Option.some(model.deckListPage),
  write: (model: Model, nextPage: DeckListPage.Model): Model =>
    modifyFields(model, { deckListPage: () => nextPage }),
  toParentMessage: message => Message.GotDeckListPageMessage({ message }),
  foldOutMessage: foldDeckListPageOutMessage,
})

const foldDeckPageOutMessage = DeckPage.OutMessage.match<
  Update.Step<Model, Message, ApiClient>
>({
  EditedDeck: edits => editDeck(edits),
  RequestedRemoveDeck: ({ deckId }) => removeDeck(deckId),
  RequestedRetryLoadDecks: () => retryDecks,
})

const deckPageSlot = {
  read: (model: Model) => Option.some(model.deckPage),
  write: (model: Model, nextPage: DeckPage.Model): Model =>
    modifyFields(model, { deckPage: () => nextPage }),
  toParentMessage: (message: DeckPage.Message) =>
    Message.GotDeckPageMessage({ message }),
}

const foldDeckPage = (maybeDeck: Option.Option<Deck.Deck>) =>
  Update.foldChild({
    update: DeckPage.update(maybeDeck),
    ...deckPageSlot,
    foldOutMessage: foldDeckPageOutMessage,
  })

const enterDeckPage =
  (deckId: Deck.DeckId): Update.Step<Model, Message, CatalogueIndexService> =>
  stepModel =>
    Update.foldChildStep({
      update: (page: DeckPage.Model) =>
        DeckPage.enter(
          page,
          DecksState.maybeDeck(stepModel.decks, deckId),
          stepModel.catalogue._tag === 'Ready',
        ),
      ...deckPageSlot,
    })(stepModel)

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
      Decks: () => ensureDecks(routed),
      Deck: ({ deckId }) =>
        Update.combine<Model, Message, Requirements>(routed, [
          ensureDecks,
          enterDeckPage(deckId),
        ]),
      NotFound: () => ({ model: routed }),
    }),
  )
}

// UPDATE

const isWaitingForDecks = (route: LoggedInRoute): boolean =>
  route._tag === 'Deck'

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

    GotDecksMessage: ({ message }) =>
      message._tag === 'SucceededLoadDecks' && isWaitingForDecks(model.route)
        ? Update.combine<Model, Message, Requirements>(model, [
            foldDecks(message),
            stepModel => enterRoute(stepModel, stepModel.route),
          ])
        : foldDecks(model, message),

    GotDeckListPageMessage: ({ message }) => foldDeckListPage(model, message),

    GotDeckPageMessage: ({ message }) =>
      Match.value(model.route).pipe(
        withUpdateReturn,
        Match.tag('Deck', ({ deckId }) =>
          foldDeckPage(DecksState.maybeDeck(model.decks, deckId))(
            model,
            message,
          ),
        ),
        Match.orElse(() => ({ model })),
      ),

    CompletedOpenDeck: () => ({ model }),

    CompletedReturnToDecks: () => ({ model }),

    ClickedRetryCatalogue: () => ({
      model: modifyFields(model, {
        catalogue: catalogue =>
          CatalogueState.Loading({ attempt: attemptOf(catalogue) + 1 }),
      }),
    }),
  })
