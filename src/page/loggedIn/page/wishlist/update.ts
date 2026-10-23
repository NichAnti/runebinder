import {
  Array,
  Effect,
  HashSet,
  Number,
  Option,
  Record,
  Schema,
  String,
} from 'effect'
import { Command, Update } from 'foldkit'
import { modifyFields } from 'foldkit/struct'

import { CatalogueQuery, Printing, Wishlist } from '../../../../domain'
import {
  CatalogueIndex,
  CatalogueIndexResource,
  type CatalogueIndexService,
} from '../../../../service'
import { Dialog, Toast } from '../../../../ui'
import { cardsByPrinting } from '../deck/lines'
import { Message, OutMessage } from './message'
import { type Model, Pending } from './model'
import {
  type Context,
  type Section,
  cardTraderNameOf,
  printingIdsOf,
  sectionOf,
} from './sections'

type UpdateReturn = Update.ReturnWithOutMessage<
  Model,
  Message,
  OutMessage,
  CatalogueIndexService
>
type EnterReturn = Update.Return<Model, Message, CatalogueIndexService>

const SEARCH_LIMIT = 8

// COMMAND

export const LoadWishlistCards = Command.define('LoadWishlistCards', {
  args: { printingIds: Schema.Array(Printing.PrintingId) },
  messages: [Message.SucceededLoadWishlistCards, Message.SkippedLoadCatalogue],
  execute: ({ printingIds }) =>
    Effect.gen(function* () {
      const index = yield* CatalogueIndexResource.get
      return Message.SucceededLoadWishlistCards({
        cards: Array.getSomes(
          Array.map(CatalogueIndex.cardIdsOwning(index, printingIds), cardId =>
            CatalogueIndex.cardById(index, cardId),
          ),
        ),
      })
    }).pipe(
      Effect.catchTag('ResourceNotAvailable', () =>
        Effect.succeed(Message.SkippedLoadCatalogue()),
      ),
    ),
})

export const SearchCardsToWish = Command.define('SearchCardsToWish', {
  args: { term: Schema.String },
  messages: [Message.SucceededSearchCardsToWish, Message.SkippedLoadCatalogue],
  execute: ({ term }) =>
    Effect.gen(function* () {
      const index = yield* CatalogueIndexResource.get
      const result = yield* CatalogueIndex.searchCards(
        index,
        CatalogueQuery.withTerm(CatalogueQuery.empty, term),
        SEARCH_LIMIT,
        [],
      )
      return Message.SucceededSearchCardsToWish({ term, cards: result.cards })
    }).pipe(
      Effect.catchTag('ResourceNotAvailable', () =>
        Effect.succeed(Message.SkippedLoadCatalogue()),
      ),
    ),
})

export const LoadCardToWish = Command.define('LoadCardToWish', {
  args: { cardId: Printing.CardId },
  messages: [Message.SucceededLoadCardToWish, Message.SkippedLoadCatalogue],
  execute: ({ cardId }) =>
    Effect.gen(function* () {
      const index = yield* CatalogueIndexResource.get
      return Option.match(CatalogueIndex.cardById(index, cardId), {
        onNone: () => Message.SkippedLoadCatalogue(),
        onSome: card => Message.SucceededLoadCardToWish({ card }),
      })
    }).pipe(
      Effect.catchTag('ResourceNotAvailable', () =>
        Effect.succeed(Message.SkippedLoadCatalogue()),
      ),
    ),
})

// TOAST

const toastFold = {
  read: (model: Model) => Option.some(model.toast),
  write: (model: Model, nextToast: Toast.Model): Model =>
    modifyFields(model, { toast: () => nextToast }),
  toParentMessage: (message: Toast.Message) =>
    Message.GotToastMessage({ message }),
  foldOutMessage: Toast.Notification.OutMessage.match<
    Update.Step<Model, Message>
  >({
    DismissedToast: () => stepModel => ({ model: stepModel }),
  }),
}

const foldToast = Update.foldChild({
  update: Toast.Notification.update,
  ...toastFold,
})
const showToast = Update.foldChild({
  update: Toast.Notification.show,
  ...toastFold,
})

// CONFIRM DIALOG

const confirmFold = {
  read: (model: Model) => Option.some(model.confirmDialog),
  write: (model: Model, nextDialog: Dialog.Model): Model =>
    modifyFields(model, { confirmDialog: () => nextDialog }),
  toParentMessage: (message: Dialog.Message) =>
    Message.GotConfirmDialogMessage({ message }),
  foldOutMessage: Dialog.OutMessage.match<Update.Step<Model, Message>>({
    Opened: () => stepModel => ({ model: stepModel }),
    Closed: () => stepModel => ({
      model: modifyFields(stepModel, { maybePending: () => Option.none() }),
    }),
  }),
}

const foldConfirm = Update.foldChild({ update: Dialog.update, ...confirmFold })
const openConfirm = Update.foldChildStep({
  update: Dialog.open,
  ...confirmFold,
})
const closeConfirm = Update.foldChildStep({
  update: Dialog.close,
  ...confirmFold,
})

const confirming = (model: Model, pending: Pending): UpdateReturn =>
  openConfirm(modifyFields(model, { maybePending: () => Option.some(pending) }))

// LINES

export const finderOf = (model: Model) => {
  const byPrinting = cardsByPrinting(model.cards)

  return (printingId: Printing.PrintingId): Option.Option<Printing.Printing> =>
    Option.flatMap(Option.fromNullishOr(byPrinting.get(printingId)), card =>
      Array.findFirst(card.printings, ({ id }) => id === printingId),
    )
}

export const cardTraderLinesOf = (model: Model, section: Section) =>
  Wishlist.cardTraderLinesOf(section.lines, finderOf(model))

const outgoingOf = (
  model: Model,
  context: Context,
  wishlist: Wishlist.WishlistRef,
) =>
  Option.flatMap(sectionOf(context, wishlist), section =>
    Option.map(
      Array.match(cardTraderLinesOf(model, section).lines, {
        onEmpty: () => Option.none(),
        onNonEmpty: Option.some,
      }),
      lines => ({ wishlist, name: cardTraderNameOf(section), lines }),
    ),
  )

// ROUTE

export const enter = (
  model: Model,
  context: Context,
  isIndexReady: boolean,
): EnterReturn => {
  const known = HashSet.fromIterable(
    Array.flatMap(Record.values(model.cards), card =>
      Array.map(card.printings, ({ id }) => id),
    ),
  )
  const missing = Array.filter(
    printingIdsOf(context),
    printingId => !HashSet.has(known, printingId),
  )

  return isIndexReady && Array.isReadonlyArrayNonEmpty(missing)
    ? { model, commands: [LoadWishlistCards({ printingIds: missing })] }
    : { model }
}

// UPDATE

const boughtText = (copies: number): string =>
  copies === 1
    ? 'Added 1 card to your collection.'
    : `Added ${copies} cards to your collection.`

export const update = (context: Context) => (model: Model, message: Message) =>
  Message.match<UpdateReturn>(message, {
    SucceededLoadWishlistCards: ({ cards }) => ({
      model: modifyFields(model, {
        cards: existing =>
          Array.reduce(cards, existing, (known, card) =>
            Record.set(known, card.id, card),
          ),
      }),
    }),

    SkippedLoadCatalogue: () => ({ model }),

    UpdatedSearch: ({ value }) => {
      const term = String.trim(value)
      const nextModel: Model = modifyFields(model, {
        searchText: () => value,
        searchResults: results => (String.isEmpty(term) ? [] : results),
      })

      return String.isEmpty(term)
        ? { model: nextModel }
        : { model: nextModel, commands: [SearchCardsToWish({ term })] }
    },

    SucceededSearchCardsToWish: ({ term, cards }) =>
      term === String.trim(model.searchText)
        ? { model: modifyFields(model, { searchResults: () => cards }) }
        : { model },

    ClickedAddCard: ({ cardId }) => ({
      model,
      commands: [LoadCardToWish({ cardId })],
    }),

    SucceededLoadCardToWish: ({ card }) => ({
      model: modifyFields(model, {
        cards: cards => Record.set(cards, card.id, card),
      }),
      outMessage: OutMessage.SteppedAdded({
        printingId: Printing.basePrinting(card).id,
        step: 1,
      }),
    }),

    ClickedStepAdded: ({ printingId, step }) => ({
      model,
      outMessage: OutMessage.SteppedAdded({ printingId, step }),
    }),

    ToggledLine: ({ lineKey, isChecked }) => ({
      model: modifyFields(model, {
        selected: selected => Record.set(selected, lineKey, isChecked),
      }),
    }),

    SelectedVersion: ({ lineKey, value }) =>
      Option.match(Schema.decodeOption(Printing.PrintingId)(value), {
        onNone: () => ({ model }),
        onSome: printingId => ({
          model: modifyFields(model, {
            versions: versions => Record.set(versions, lineKey, printingId),
          }),
        }),
      }),

    ClickedBought: ({ purchases }) => {
      const copies = Number.sumAll(Array.map(purchases, ({ copies }) => copies))
      const toastShow = showToast(
        modifyFields(model, { selected: () => ({}) }),
        { variant: 'Success', payload: { text: boughtText(copies) } },
      )

      return {
        model: toastShow.model,
        commands: toastShow.commands ?? [],
        outMessage: OutMessage.MarkedBought({ purchases }),
      }
    },

    ClickedCreate: ({ wishlist }) =>
      Option.match(outgoingOf(model, context, wishlist), {
        onNone: () => ({ model }),
        onSome: outgoing => ({
          model,
          outMessage: OutMessage.RequestedCreate(outgoing),
        }),
      }),

    ClickedSync: ({ wishlist }) =>
      Option.match(sectionOf(context, wishlist), {
        onNone: () => ({ model }),
        onSome: ({ title }) =>
          confirming(model, Pending.Sync({ wishlist, title })),
      }),

    ClickedDelete: ({ wishlist }) =>
      Option.match(sectionOf(context, wishlist), {
        onNone: () => ({ model }),
        onSome: ({ title }) =>
          confirming(model, Pending.DeleteLinked({ wishlist, title })),
      }),

    ClickedDeleteRemote: ({ wishlistId, name }) =>
      confirming(model, Pending.DeleteRemote({ wishlistId, name })),

    ClickedConfirm: () =>
      Option.match(model.maybePending, {
        onNone: () => ({ model }),
        onSome: pending => {
          const closed = closeConfirm(
            modifyFields(model, { maybePending: () => Option.none() }),
          )
          const maybeOutMessage = Pending.match<Option.Option<OutMessage>>(
            pending,
            {
              Sync: ({ wishlist }) =>
                Option.map(
                  outgoingOf(model, context, wishlist),
                  OutMessage.RequestedSync,
                ),
              DeleteLinked: ({ wishlist }) =>
                Option.some(OutMessage.RequestedDelete({ wishlist })),
              DeleteRemote: ({ wishlistId }) =>
                Option.some(OutMessage.RequestedDeleteRemote({ wishlistId })),
            },
          )

          return Option.match(maybeOutMessage, {
            onNone: () => closed,
            onSome: outMessage => ({ ...closed, outMessage }),
          })
        },
      }),

    ClickedConnect: () => ({
      model,
      outMessage: OutMessage.RequestedConnect(),
    }),

    ClickedRefreshRemote: () => ({
      model,
      outMessage: OutMessage.RequestedRefreshRemote(),
    }),

    GotConfirmDialogMessage: ({ message }) => foldConfirm(model, message),

    ClickedRetry: () => ({ model, outMessage: OutMessage.RequestedRetry() }),

    GotToastMessage: ({ message }) => foldToast(model, message),
  })
