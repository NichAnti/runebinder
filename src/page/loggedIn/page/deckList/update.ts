import {
  Array,
  Effect,
  HashSet,
  Option,
  Record,
  Result,
  Schema,
  String,
  pipe,
} from 'effect'
import { Command, Update } from 'foldkit'
import { Rule, makeRules, validate } from 'foldkit/fieldValidation'
import { modifyFields } from 'foldkit/struct'

import { Deck, DeckCode, Printing } from '../../../../domain'
import {
  CatalogueIndex,
  CatalogueIndexResource,
  type CatalogueIndexService,
  Clipboard,
} from '../../../../service'
import { Dialog, Toast } from '../../../../ui'
import { Message, OutMessage } from './message'
import { Import, type Model, init } from './model'
import { problemText } from './problemText'

type UpdateReturn = Update.ReturnWithOutMessage<
  Model,
  Message,
  OutMessage,
  CatalogueIndexService
>

// VALIDATION

const nameRules = makeRules({
  required: 'Give the deck a name',
  rules: [
    Rule.maxLength(
      Deck.MAX_NAME_LENGTH,
      `Use at most ${Deck.MAX_NAME_LENGTH} characters`,
    ),
  ],
})
const codeRules = makeRules({ required: 'Paste a deck code' })

const validateName = validate(nameRules)
const validateCode = validate(codeRules)

// COMMAND

export const ReadDeckCode = Command.define('ReadDeckCode', {
  args: { name: Deck.DeckName, code: Schema.String },
  messages: [
    Message.SucceededReadDeckCode,
    Message.FailedReadDeckCode,
    Message.SkippedReadDeckCode,
  ],
  execute: ({ name, code }) =>
    Effect.gen(function* () {
      const index = yield* CatalogueIndexResource.get
      const lookup = DeckCode.lookupFrom(
        Array.flatMap(Array.fromIterable(index.cards.values()), card =>
          Array.fromIterable(card.printings),
        ),
      )

      return Result.match(DeckCode.decode(code, lookup), {
        onSuccess: contents =>
          Message.SucceededReadDeckCode({ name, contents }),
        onFailure: problem => Message.FailedReadDeckCode({ problem }),
      })
    }).pipe(
      Effect.catchTag('ResourceNotAvailable', () =>
        Effect.succeed(Message.SkippedReadDeckCode()),
      ),
    ),
})

export const LoadDeckListCards = Command.define('LoadDeckListCards', {
  args: { printingIds: Schema.Array(Printing.PrintingId) },
  messages: [
    Message.SucceededLoadDeckListCards,
    Message.SkippedLoadDeckListCards,
  ],
  execute: ({ printingIds }) =>
    Effect.gen(function* () {
      const index = yield* CatalogueIndexResource.get
      return Message.SucceededLoadDeckListCards({
        cards: Array.getSomes(
          Array.map(CatalogueIndex.cardIdsOwning(index, printingIds), cardId =>
            CatalogueIndex.cardById(index, cardId),
          ),
        ),
      })
    }).pipe(
      Effect.catchTag('ResourceNotAvailable', () =>
        Effect.succeed(Message.SkippedLoadDeckListCards()),
      ),
    ),
})

export const CopyDeckCode = Command.define('CopyDeckCode', {
  args: { code: DeckCode.DeckCode },
  messages: [Message.CompletedCopyDeckCode, Message.FailedCopyDeckCode],
  execute: ({ code }) =>
    Clipboard.writeText(code).pipe(
      Effect.as(Message.CompletedCopyDeckCode({ code })),
      Effect.catch(() => Effect.succeed(Message.FailedCopyDeckCode({ code }))),
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

const toastWith = (model: Model, text: string): UpdateReturn =>
  showToast(model, { variant: 'Success', payload: { text } })

// DIALOGS

const dialogFold = (
  read: (model: Model) => Dialog.Model,
  write: (model: Model, nextDialog: Dialog.Model) => Model,
  toParentMessage: (message: Dialog.Message) => Message,
) => ({
  read: (model: Model) => Option.some(read(model)),
  write,
  toParentMessage,
  foldOutMessage: Dialog.OutMessage.match<Update.Step<Model, Message>>({
    Opened: () => stepModel => ({ model: stepModel }),
    Closed: () => stepModel => ({ model: stepModel }),
  }),
})

const newDeckDialogFold = dialogFold(
  model => model.newDeckDialog,
  (model, nextDialog) =>
    modifyFields(model, { newDeckDialog: () => nextDialog }),
  message => Message.GotNewDeckDialogMessage({ message }),
)

const importDialogFold = dialogFold(
  model => model.importDialog,
  (model, nextDialog) =>
    modifyFields(model, { importDialog: () => nextDialog }),
  message => Message.GotImportDialogMessage({ message }),
)

const foldNewDeckDialog = Update.foldChild({
  update: Dialog.update,
  ...newDeckDialogFold,
})
const openNewDeckDialog = Update.foldChildStep({
  update: Dialog.open,
  ...newDeckDialogFold,
})
const closeNewDeckDialog = Update.foldChildStep({
  update: Dialog.close,
  ...newDeckDialogFold,
})
const deleteDialogFold = {
  read: (model: Model) => Option.some(model.deleteDialog),
  write: (model: Model, nextDialog: Dialog.Model): Model =>
    modifyFields(model, { deleteDialog: () => nextDialog }),
  toParentMessage: (message: Dialog.Message) =>
    Message.GotDeleteDialogMessage({ message }),
  foldOutMessage: Dialog.OutMessage.match<Update.Step<Model, Message>>({
    Opened: () => stepModel => ({ model: stepModel }),
    Closed: () => stepModel => ({
      model: modifyFields(stepModel, {
        maybePendingDelete: () => Option.none(),
      }),
    }),
  }),
}

const foldDeleteDialog = Update.foldChild({
  update: Dialog.update,
  ...deleteDialogFold,
})
const openDeleteDialog = Update.foldChildStep({
  update: Dialog.open,
  ...deleteDialogFold,
})
const closeDeleteDialog = Update.foldChildStep({
  update: Dialog.close,
  ...deleteDialogFold,
})

const foldImportDialog = Update.foldChild({
  update: Dialog.update,
  ...importDialogFold,
})
const openImportDialog = Update.foldChildStep({
  update: Dialog.open,
  ...importDialogFold,
})
const closeImportDialog = Update.foldChildStep({
  update: Dialog.close,
  ...importDialogFold,
})

// ROUTE

const printingIdsOf = (
  decks: ReadonlyArray<Deck.Deck>,
): ReadonlyArray<Printing.PrintingId> =>
  Array.dedupe(
    Array.flatMap(decks, ({ contents }) => [
      ...Option.toArray(contents.maybeLegend),
      ...Option.toArray(contents.maybeChosenChampion),
      ...Array.flatMap(
        [
          contents.main,
          contents.runes,
          contents.battlefields,
          contents.sideboard,
        ],
        Array.map(({ printingId }) => printingId),
      ),
      ...contents.additionalLegends,
    ]),
  )

export const enter = (
  model: Model,
  decks: ReadonlyArray<Deck.Deck>,
  isIndexReady: boolean,
): Update.Return<Model, Message, CatalogueIndexService> => {
  const known = HashSet.fromIterable(
    Array.flatMap(Record.values(model.cards), card =>
      Array.map(card.printings, ({ id }) => id),
    ),
  )
  const missing = Array.filter(
    printingIdsOf(decks),
    printingId => !HashSet.has(known, printingId),
  )

  return isIndexReady && Array.isReadonlyArrayNonEmpty(missing)
    ? { model, commands: [LoadDeckListCards({ printingIds: missing })] }
    : { model }
}

// UPDATE

const findDeck = (
  decks: ReadonlyArray<Deck.Deck>,
  deckId: Deck.DeckId,
): Option.Option<Deck.Deck> => Array.findFirst(decks, ({ id }) => id === deckId)

export const update =
  (decks: ReadonlyArray<Deck.Deck>) => (model: Model, message: Message) =>
    Message.match<UpdateReturn>(message, {
      ClickedCopyCode: ({ deckId }) =>
        Option.match(findDeck(decks, deckId), {
          onNone: () => ({ model }),
          onSome: deck =>
            Result.match(DeckCode.encode(deck.contents), {
              onSuccess: code => ({
                model,
                commands: [CopyDeckCode({ code })],
              }),
              onFailure: problem => toastWith(model, problemText(problem)),
            }),
        }),

      CompletedCopyDeckCode: () => toastWith(model, 'Copied the deck code.'),

      FailedCopyDeckCode: ({ code }) =>
        toastWith(model, `Copy the deck code by hand: ${code}`),

      ClickedDuplicate: ({ deckId }) =>
        Option.match(findDeck(decks, deckId), {
          onNone: () => ({ model }),
          onSome: deck => ({
            model,
            outMessage: OutMessage.RequestedCreateDeck({
              name: Option.getOrElse(
                Deck.parseName(`${deck.name} (copy)`),
                () => deck.name,
              ),
              contents: deck.contents,
            }),
          }),
        }),

      ClickedDelete: ({ deckId }) =>
        Option.match(findDeck(decks, deckId), {
          onNone: () => ({ model }),
          onSome: deck =>
            openDeleteDialog(
              modifyFields(model, {
                maybePendingDelete: () =>
                  Option.some({ deckId: deck.id, name: deck.name }),
              }),
            ),
        }),

      ClickedConfirmDelete: () =>
        Option.match(model.maybePendingDelete, {
          onNone: () => ({ model }),
          onSome: ({ deckId }) =>
            pipe(
              closeDeleteDialog(
                modifyFields(model, {
                  maybePendingDelete: () => Option.none(),
                }),
              ),
              Update.withOutMessage(OutMessage.RequestedRemoveDeck({ deckId })),
            ),
        }),

      GotDeleteDialogMessage: ({ message }) => foldDeleteDialog(model, message),

      GotToastMessage: ({ message }) => foldToast(model, message),

      SucceededLoadDeckListCards: ({ cards }) => ({
        model: modifyFields(model, {
          cards: existing =>
            Array.reduce(cards, existing, (known, card) =>
              Record.set(known, card.id, card),
            ),
        }),
      }),

      SkippedLoadDeckListCards: () => ({ model }),

      ClickedNewDeck: () => openNewDeckDialog(model),

      ClickedImportCode: () => openImportDialog(model),

      GotNewDeckDialogMessage: ({ message }) =>
        foldNewDeckDialog(model, message),

      GotImportDialogMessage: ({ message }) => foldImportDialog(model, message),

      UpdatedNewName: ({ value }) => ({
        model: modifyFields(model, { newName: () => validateName(value) }),
      }),

      SubmittedNewDeck: () =>
        Option.match(Deck.parseName(model.newName.value), {
          onNone: () => ({
            model: modifyFields(model, {
              newName: () => validateName(model.newName.value),
            }),
          }),
          onSome: name => {
            const dialogClose = closeNewDeckDialog(
              modifyFields(model, { newName: () => init().newName }),
            )

            return pipe(
              dialogClose,
              Update.withOutMessage(
                OutMessage.RequestedCreateDeck({ name, contents: Deck.empty }),
              ),
            )
          },
        }),

      UpdatedImportName: ({ value }) => ({
        model: modifyFields(model, { importName: () => validateName(value) }),
      }),

      UpdatedImportCode: ({ value }) => ({
        model: modifyFields(model, {
          importCode: () => validateCode(value),
          import: () => Import.Idle(),
        }),
      }),

      SubmittedImport: () => {
        const maybeName = Deck.parseName(model.importName.value)
        const code = model.importCode.value

        if (Option.isNone(maybeName) || String.isEmpty(String.trim(code))) {
          return {
            model: modifyFields(model, {
              importName: () => validateName(model.importName.value),
              importCode: () => validateCode(code),
            }),
          }
        } else {
          return {
            model: modifyFields(model, { import: () => Import.Reading() }),
            commands: [ReadDeckCode({ name: maybeName.value, code })],
          }
        }
      },

      SucceededReadDeckCode: ({ name, contents }) => {
        const dialogClose = closeImportDialog(
          modifyFields(model, {
            importName: () => init().importName,
            importCode: () => init().importCode,
            import: () => Import.Idle(),
          }),
        )

        return pipe(
          dialogClose,
          Update.withOutMessage(
            OutMessage.RequestedCreateDeck({ name, contents }),
          ),
        )
      },

      FailedReadDeckCode: ({ problem }) => ({
        model: modifyFields(model, {
          import: () => Import.Failed({ problem }),
        }),
      }),

      SkippedReadDeckCode: () => ({
        model: modifyFields(model, { import: () => Import.Idle() }),
      }),

      ClickedRetryLoadDecks: () => ({
        model,
        outMessage: OutMessage.RequestedRetryLoadDecks(),
      }),
    })
