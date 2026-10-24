import { Array, Effect, Match, Option } from 'effect'
import { Command, Update } from 'foldkit'
import { pushUrl, replaceUrl } from 'foldkit/navigation'
import { modifyFields } from 'foldkit/struct'

import { Collection, Deck, Printing, Wishlist } from '../../domain'
import {
  type CatalogueRoute,
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
import * as CardTraderState from './cardTrader'
import * as CardTraderWishlists from './cardTraderWishlists'
import * as CollectionState from './collection'
import * as DecksState from './decks'
import { Message } from './message'
import { CatalogueState, type Model } from './model'
import * as CardPage from './page/card'
import * as CardTraderWishlistPage from './page/cardTraderWishlist'
import * as CataloguePage from './page/catalogue'
import * as DeckPage from './page/deck'
import * as DeckListPage from './page/deckList'
import * as WishlistPage from './page/wishlist'
import * as WishlistState from './wishlist'

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

export const wantedOf = (model: Model): Option.Option<Wishlist.Wanted> =>
  model.decks._tag === 'Ready' &&
  model.collection._tag === 'Ready' &&
  model.wishlist._tag === 'Ready'
    ? Option.some(
        Wishlist.wantedOf(
          model.decks.decks,
          model.collection.owned,
          model.wishlist.added,
        ),
      )
    : Option.none()

export const contextOf = (
  { _tag, ...query }: CatalogueRoute,
  model: Model,
): CataloguePage.Context => ({
  query,
  maybeOwned: CollectionState.maybeOwned(model.collection),
  maybeWanted: wantedOf(model),
})

const cataloguePageSlot = {
  read: (model: Model) => Option.some(model.cataloguePage),
  write: (model: Model, nextPage: CataloguePage.Model): Model =>
    modifyFields(model, { cataloguePage: () => nextPage }),
  toParentMessage: (message: CataloguePage.Message) =>
    Message.GotCataloguePageMessage({ message }),
}

const readCardPage = (model: Model) => Option.some(model.cardPage)
const writeCardPage = (model: Model, nextCardPage: CardPage.Model): Model =>
  modifyFields(model, { cardPage: () => nextCardPage })
const toCardPageMessage = (message: CardPage.Message): Message =>
  Message.GotCardPageMessage({ message })

const foldCataloguePageEntry = Update.foldChild({
  update: (
    page: CataloguePage.Model,
    { context, isIndexReady }: CataloguePageEntry,
  ) => CataloguePage.enter(page, context, isIndexReady),
  ...cataloguePageSlot,
})

const foldCataloguePageOutMessage = CataloguePage.OutMessage.match<
  Update.Step<Model, Message, ApiClient>
>({
  SteppedQuantity: stepped => stepQuantity(stepped),
  RequestedCollectionRetry: () => retryCollection,
})

const foldCataloguePage = (context: CataloguePage.Context) =>
  Update.foldChild({
    update: CataloguePage.update(context),
    ...cataloguePageSlot,
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
  Update.Step<Model, Message, Requirements>
>({
  SteppedQuantity: stepped => stepQuantity(stepped),
  RequestedCollectionRetry: () => retryCollection,
  AddedToWishlist: ({ printingId }) => stepWishlist({ printingId, step: 1 }),
})

const foldCardPage = Update.foldChild({
  update: CardPage.update,
  read: readCardPage,
  write: writeCardPage,
  toParentMessage: toCardPageMessage,
  foldOutMessage: foldCardPageOutMessage,
})

// CARDTRADER

const cardTraderFold = {
  read: (model: Model) => Option.some(model.cardTrader),
  write: (model: Model, nextCardTrader: CardTraderState.Model): Model =>
    modifyFields(model, { cardTrader: () => nextCardTrader }),
  toParentMessage: (message: CardTraderState.Message) =>
    Message.GotCardTraderMessage({ message }),
}

const foldCardTrader = Update.foldChild({
  update: CardTraderState.update,
  ...cardTraderFold,
})
const ensureCardTraderChecked = Update.foldChildStep({
  update: CardTraderState.ensureChecked,
  ...cardTraderFold,
})
const verifyCardTrader = Update.foldChildStep({
  update: CardTraderState.verify,
  ...cardTraderFold,
})
const rejectCardTraderToken = Update.foldChildStep({
  update: CardTraderState.rejectToken,
  ...cardTraderFold,
})
export const openConnect = Update.foldChildStep({
  update: CardTraderState.open,
  ...cardTraderFold,
})

const isConnected = (model: Model): boolean =>
  CardTraderState.isConnected(model.cardTrader)

const whenConnected =
  <R>(step: Update.Step<Model, Message, R>): Update.Step<Model, Message, R> =>
  stepModel =>
    isConnected(stepModel) ? step(stepModel) : { model: stepModel }

const remoteFold = {
  read: (model: Model) => Option.some(model.cardTraderWishlists),
  write: (model: Model, nextRemote: CardTraderWishlists.Model): Model =>
    modifyFields(model, { cardTraderWishlists: () => nextRemote }),
  toParentMessage: (message: CardTraderWishlists.Message) =>
    Message.GotCardTraderWishlistsMessage({ message }),
}

const foldRemote = Update.foldChild({
  update: CardTraderWishlists.update,
  ...remoteFold,
})
const ensureListed = Update.foldChildStep({
  update: CardTraderWishlists.ensureListed,
  ...remoteFold,
})
const refreshRemote = Update.foldChildStep({
  update: CardTraderWishlists.refresh,
  ...remoteFold,
})
const ensureShown = Update.foldChild({
  update: CardTraderWishlists.ensureShown,
  ...remoteFold,
})
const deleteRemote = Update.foldChild({
  update: CardTraderWishlists.remove,
  ...remoteFold,
})

const withRemote =
  (
    f: (remote: CardTraderWishlists.Model) => CardTraderWishlists.Model,
  ): Update.Step<Model, Message> =>
  stepModel => ({
    model: modifyFields(stepModel, { cardTraderWishlists: f }),
  })

const forgetRemoteWhenDisconnected: Update.Step<Model, Message> = stepModel =>
  isConnected(stepModel) ||
  stepModel.cardTraderWishlists.listing._tag === 'NotLoaded'
    ? { model: stepModel }
    : withRemote(CardTraderWishlists.reset)(stepModel)

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

const retryCollection = Update.foldChildStep({
  update: CollectionState.retry,
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
  Update.Step<Model, Message, Requirements>
>({
  EditedDeck: edits => editDeck(edits),
  RequestedRemoveDeck: ({ deckId }) => removeDeck(deckId),
  SteppedOwned: stepped => stepQuantity(stepped),
  RequestedCollectionRetry: () => retryCollection,
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

// WISHLIST

const wishlistFold = {
  read: (model: Model) => Option.some(model.wishlist),
  write: (model: Model, nextWishlist: WishlistState.Model): Model =>
    modifyFields(model, { wishlist: () => nextWishlist }),
  toParentMessage: (message: WishlistState.Message) =>
    Message.GotWishlistMessage({ message }),
}

const foldWishlist = Update.foldChild({
  update: WishlistState.update,
  ...wishlistFold,
})
const ensureWishlist = Update.foldChildStep({
  update: WishlistState.ensureLoaded,
  ...wishlistFold,
})
const retryWishlist = Update.foldChildStep({
  update: WishlistState.retry,
  ...wishlistFold,
})
const stepWishlist = Update.foldChild({
  update: WishlistState.step,
  ...wishlistFold,
})
const createWishlist = Update.foldChild({
  update: WishlistState.create,
  ...wishlistFold,
})
const syncWishlist = Update.foldChild({
  update: WishlistState.sync,
  ...wishlistFold,
})
const removeWishlist = Update.foldChild({
  update: WishlistState.remove,
  ...wishlistFold,
})
const importIntoWishlist = Update.foldChild({
  update: WishlistState.addAll,
  ...wishlistFold,
})

export const wishlistContextOf = (
  model: Model,
): Option.Option<WishlistPage.Context> =>
  model.decks._tag === 'Ready' &&
  model.collection._tag === 'Ready' &&
  model.wishlist._tag === 'Ready'
    ? Option.some({
        decks: model.decks.decks,
        owned: model.collection.owned,
        added: model.wishlist.added,
      })
    : Option.none()

const changeQuantity = Update.foldChild({
  update: CollectionState.change,
  read: readCollection,
  write: writeCollection,
  toParentMessage: toCollectionMessage,
})

const setWishlistAdded = Update.foldChild({
  update: WishlistState.setAdded,
  ...wishlistFold,
})

const recordPurchase =
  (
    purchase: WishlistPage.Purchase,
  ): Update.Step<Model, Message, Requirements> =>
  stepModel => {
    const owned = Option.getOrElse(
      CollectionState.maybeOwned(stepModel.collection),
      (): Collection.Owned => ({}),
    )
    const added = Option.getOrElse(
      WishlistState.maybeAdded(stepModel.wishlist),
      (): Collection.Owned => ({}),
    )

    return Update.combine<Model, Message, Requirements>(stepModel, [
      changeQuantity({
        printingId: purchase.bought,
        quantity: Collection.clampQuantity(
          Collection.quantityOf(owned, purchase.bought) + purchase.copies,
        ),
      }),
      ...(purchase.isCustom
        ? [
            setWishlistAdded({
              printingId: purchase.wanted,
              quantity: Collection.clampQuantity(
                Collection.quantityOf(added, purchase.wanted) - purchase.copies,
              ),
            }),
          ]
        : []),
    ])
  }

const foldWishlistPageOutMessage = WishlistPage.OutMessage.match<
  Update.Step<Model, Message, Requirements>
>({
  SteppedAdded: stepped => stepWishlist(stepped),
  RemovedAdded: ({ printingId }) =>
    setWishlistAdded({ printingId, quantity: Collection.Quantity.make(0) }),
  RequestedCreate: outgoing => createWishlist(outgoing),
  RequestedSync: outgoing => syncWishlist(outgoing),
  RequestedDelete: ({ wishlist }) => removeWishlist(wishlist),
  RequestedDeleteRemote: ({ wishlistId }) => deleteRemote(wishlistId),
  RequestedConnect: () => openConnect,
  RequestedRefreshRemote: () => refreshRemote,
  MarkedBought: ({ purchases }) =>
    Update.combine<Model, Message, Requirements>(
      Array.map(purchases, recordPurchase),
    ),
  RequestedRetry: () => stepModel =>
    Update.combine<Model, Message, Requirements>(stepModel, [
      retryDecks,
      retryCollection,
      retryWishlist,
    ]),
})

const wishlistPageSlot = {
  read: (model: Model) => Option.some(model.wishlistPage),
  write: (model: Model, nextPage: WishlistPage.Model): Model =>
    modifyFields(model, { wishlistPage: () => nextPage }),
  toParentMessage: (message: WishlistPage.Message) =>
    Message.GotWishlistPageMessage({ message }),
}

const foldWishlistPage = (context: WishlistPage.Context) =>
  Update.foldChild({
    update: WishlistPage.update(context),
    ...wishlistPageSlot,
    foldOutMessage: foldWishlistPageOutMessage,
  })

const enterWishlistPage: Update.Step<
  Model,
  Message,
  CatalogueIndexService
> = stepModel =>
  Option.match(wishlistContextOf(stepModel), {
    onNone: () => ({ model: stepModel }),
    onSome: context =>
      Update.foldChildStep({
        update: (page: WishlistPage.Model) =>
          WishlistPage.enter(
            page,
            context,
            stepModel.catalogue._tag === 'Ready',
          ),
        ...wishlistPageSlot,
      })(stepModel),
  })

const cardTraderWishlistPageSlot = {
  read: (model: Model) => Option.some(model.cardTraderWishlistPage),
  write: (model: Model, nextPage: CardTraderWishlistPage.Model): Model =>
    modifyFields(model, { cardTraderWishlistPage: () => nextPage }),
  toParentMessage: (message: CardTraderWishlistPage.Message) =>
    Message.GotCardTraderWishlistPageMessage({ message }),
}

const foldCardTraderWishlistPage = (
  wishlistId: Wishlist.CardTraderWishlistId,
) =>
  Update.foldChild({
    update: CardTraderWishlistPage.update,
    ...cardTraderWishlistPageSlot,
    foldOutMessage: CardTraderWishlistPage.OutMessage.match<
      Update.Step<Model, Message, Requirements>
    >({
      Imported: ({ items }) => importIntoWishlist(items),
      RequestedConnect: () => openConnect,
      RequestedRetry: () => ensureShown(wishlistId),
    }),
  })

const enterCardTraderWishlistPage =
  (
    wishlistId: Wishlist.CardTraderWishlistId,
  ): Update.Step<Model, Message, CatalogueIndexService> =>
  stepModel =>
    Update.foldChildStep({
      update: (page: CardTraderWishlistPage.Model) =>
        CardTraderWishlistPage.enter(
          page,
          Option.flatMap(
            CardTraderWishlists.detailOf(
              stepModel.cardTraderWishlists,
              wishlistId,
            ),
            detail =>
              detail._tag === 'Ready'
                ? Option.some(detail.wishlist)
                : Option.none(),
          ),
          stepModel.catalogue._tag === 'Ready',
        ),
      ...cardTraderWishlistPageSlot,
    })(stepModel)

// ROUTE

const enterWishlistRoute = (
  routed: Model,
  steps: ReadonlyArray<Update.Step<Model, Message, Requirements>>,
): UpdateReturn =>
  Update.combine<Model, Message, Requirements>(routed, [
    ensureDecks,
    ensureCollection,
    ensureWishlist,
    enterWishlistPage,
    ...steps,
  ])

const enterPage = (model: Model, route: LoggedInRoute): UpdateReturn => {
  const isIndexReady = model.catalogue._tag === 'Ready'

  return Match.value(route).pipe(
    withUpdateReturn,
    Match.tagsExhaustive({
      Catalogue: catalogueRoute =>
        Update.combine<Model, Message, Requirements>(model, [
          foldCataloguePageEntry({
            context: contextOf(catalogueRoute, model),
            isIndexReady,
          }),
          ensureCollection,
          ensureDecks,
          ensureWishlist,
        ]),
      Card: ({ cardId }) =>
        Update.combine<Model, Message, Requirements>(model, [
          foldCardPageEntry({ cardId, isIndexReady }),
          ensureCollection,
          ensureWishlist,
          ensureDecks,
        ]),
      CardTrader: () => verifyCardTrader(model),
      Decks: () => ensureDecks(model),
      Deck: ({ deckId }) =>
        Update.combine<Model, Message, Requirements>(model, [
          ensureDecks,
          ensureCollection,
          ensureWishlist,
          enterDeckPage(deckId),
        ]),
      Wishlists: () => enterWishlistRoute(model, [whenConnected(ensureListed)]),
      CustomWishlist: () => enterWishlistRoute(model, []),
      DeckWishlist: () => enterWishlistRoute(model, []),
      CardTraderWishlist: ({ wishlistId }) =>
        Update.combine<Model, Message, Requirements>(model, [
          ensureWishlist,
          whenConnected(stepModel => ensureShown(stepModel, wishlistId)),
          enterCardTraderWishlistPage(wishlistId),
        ]),
      NotFound: () => ({ model }),
    }),
  )
}

export const enterRoute = (model: Model, route: LoggedInRoute): UpdateReturn =>
  Update.combine<Model, Message, Requirements>(
    modifyFields(model, { route: () => route }),
    [ensureCardTraderChecked, stepModel => enterPage(stepModel, route)],
  )

const reenterRoute: Update.Step<Model, Message, Requirements> = stepModel =>
  enterRoute(stepModel, stepModel.route)

// UPDATE

const isWishlistRoute = (route: LoggedInRoute): boolean =>
  route._tag === 'Wishlists' ||
  route._tag === 'CustomWishlist' ||
  route._tag === 'DeckWishlist'

const isWantedView = (route: LoggedInRoute): boolean =>
  route._tag === 'Catalogue' && route.ownership === 'Wanted'

const isWaitingForDecks = (route: LoggedInRoute): boolean =>
  route._tag === 'Deck' || isWishlistRoute(route) || isWantedView(route)

const isWaitingForCollection = (route: LoggedInRoute): boolean =>
  isWishlistRoute(route) ||
  (route._tag === 'Catalogue' && route.ownership !== 'All')

const isConnectedNow = (message: CardTraderState.Message): boolean =>
  message._tag === 'FoundStoredToken' ||
  message._tag === 'SucceededConnectCardTrader'

const remoteChangeOf = (
  message: WishlistState.Message,
): Option.Option<Update.Step<Model, Message, Requirements>> => {
  if (message._tag === 'SucceededCreateOnCardTrader') {
    return Option.some(
      withRemote(remote =>
        CardTraderWishlists.added(remote, {
          id: message.cardTraderWishlistId,
          name: message.name,
        }),
      ),
    )
  } else if (message._tag === 'SucceededSyncOnCardTrader') {
    return Option.some(
      withRemote(remote => {
        const withNew = CardTraderWishlists.added(remote, {
          id: message.cardTraderWishlistId,
          name: message.name,
        })
        return message.isPreviousDeleted
          ? CardTraderWishlists.removed(withNew, message.previousId)
          : withNew
      }),
    )
  } else if (message._tag === 'SucceededDeleteOnCardTrader') {
    return Option.some(
      withRemote(remote =>
        CardTraderWishlists.removed(remote, message.cardTraderWishlistId),
      ),
    )
  } else if (
    message._tag === 'FailedCardTraderOperation' &&
    message.reason === 'InvalidToken'
  ) {
    return Option.some(
      Update.combine<Model, Message, CardTraderClient | TokenStore>([
        rejectCardTraderToken,
        forgetRemoteWhenDisconnected,
      ]),
    )
  } else {
    return Option.none()
  }
}

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
          foldCataloguePage(contextOf(catalogueRoute, model))(model, message),
        ),
        Match.orElse(() => ({ model })),
      ),

    GotCardPageMessage: ({ message }) => foldCardPage(model, message),

    GotCardTraderMessage: ({ message }) =>
      Update.combine<Model, Message, Requirements>(model, [
        foldCardTrader(message),
        forgetRemoteWhenDisconnected,
        ...(isConnectedNow(message) ? [reenterRoute] : []),
      ]),

    GotCardTraderWishlistsMessage: ({ message }) =>
      Update.combine<Model, Message, Requirements>(model, [
        foldRemote(message),
        ...(CardTraderWishlists.isRejected(message)
          ? [rejectCardTraderToken, forgetRemoteWhenDisconnected]
          : []),
        ...(message._tag === 'SucceededShowWishlist' &&
        model.route._tag === 'CardTraderWishlist'
          ? [reenterRoute]
          : []),
      ]),

    GotCardTraderWishlistPageMessage: ({ message }) =>
      Match.value(model.route).pipe(
        withUpdateReturn,
        Match.tag('CardTraderWishlist', ({ wishlistId }) =>
          foldCardTraderWishlistPage(wishlistId)(model, message),
        ),
        Match.orElse(() => ({ model })),
      ),

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
            reenterRoute,
          ])
        : foldCollection(model, message),

    GotDecksMessage: ({ message }) =>
      message._tag === 'SucceededLoadDecks' && isWaitingForDecks(model.route)
        ? Update.combine<Model, Message, Requirements>(model, [
            foldDecks(message),
            reenterRoute,
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

    GotWishlistMessage: ({ message }) =>
      Update.combine<Model, Message, Requirements>(model, [
        foldWishlist(message),
        ...Option.toArray(remoteChangeOf(message)),
        ...(message._tag === 'SucceededLoadWishlist' &&
        (isWishlistRoute(model.route) || isWantedView(model.route))
          ? [reenterRoute]
          : []),
      ]),

    GotWishlistPageMessage: ({ message }) =>
      Option.match(wishlistContextOf(model), {
        onNone: () => ({ model }),
        onSome: context => foldWishlistPage(context)(model, message),
      }),

    CompletedOpenDeck: () => ({ model }),

    CompletedReturnToDecks: () => ({ model }),

    ClickedRetryCatalogue: () => ({
      model: modifyFields(model, {
        catalogue: catalogue =>
          CatalogueState.Loading({ attempt: attemptOf(catalogue) + 1 }),
      }),
    }),
  })
