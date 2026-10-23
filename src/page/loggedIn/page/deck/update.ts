import {
  Array,
  Effect,
  HashSet,
  Option,
  Record,
  Result,
  Schema,
  String,
} from 'effect'
import { Command, Update } from 'foldkit'
import {
  NotValidated,
  Rule,
  makeRules,
  validate,
} from 'foldkit/fieldValidation'
import { modifyFields } from 'foldkit/struct'

import {
  CatalogueQuery,
  Deck,
  DeckCode,
  type DeckEdit,
  type DeckStructure,
  Printing,
} from '../../../../domain'
import {
  CatalogueIndex,
  CatalogueIndexResource,
  type CatalogueIndexService,
} from '../../../../service'
import * as CardPanel from '../../cardPanel'
import { Message, OutMessage } from './message'
import { Export, type Model, init } from './model'

type UpdateReturn = Update.ReturnWithOutMessage<
  Model,
  Message,
  OutMessage,
  CatalogueIndexService
>

type EnterReturn = Update.Return<Model, Message, CatalogueIndexService>

const SEARCH_LIMIT = 8

const nameRules = makeRules({
  required: 'Give the deck a name',
  rules: [
    Rule.maxLength(
      Deck.MAX_NAME_LENGTH,
      `Use at most ${Deck.MAX_NAME_LENGTH} characters`,
    ),
  ],
})
const validateName = validate(nameRules)

// COMMAND

export const LoadDeckCards = Command.define('LoadDeckCards', {
  args: { printingIds: Schema.Array(Printing.PrintingId) },
  messages: [Message.SucceededLoadDeckCards, Message.SkippedLoadCatalogue],
  execute: ({ printingIds }) =>
    Effect.gen(function* () {
      const index = yield* CatalogueIndexResource.get
      const cardIds = CatalogueIndex.cardIdsOwning(index, printingIds)
      return Message.SucceededLoadDeckCards({
        cards: Array.getSomes(
          Array.map(cardIds, cardId => CatalogueIndex.cardById(index, cardId)),
        ),
      })
    }).pipe(
      Effect.catchTag('ResourceNotAvailable', () =>
        Effect.succeed(Message.SkippedLoadCatalogue()),
      ),
    ),
})

export const SearchCardsToAdd = Command.define('SearchCardsToAdd', {
  args: { term: Schema.String },
  messages: [Message.SucceededSearchCardsToAdd, Message.SkippedLoadCatalogue],
  execute: ({ term }) =>
    Effect.gen(function* () {
      const index = yield* CatalogueIndexResource.get
      const result = yield* CatalogueIndex.searchCards(
        index,
        CatalogueQuery.withTerm(CatalogueQuery.empty, term),
        SEARCH_LIMIT,
        [],
      )
      return Message.SucceededSearchCardsToAdd({ term, cards: result.cards })
    }).pipe(
      Effect.catchTag('ResourceNotAvailable', () =>
        Effect.succeed(Message.SkippedLoadCatalogue()),
      ),
    ),
})

export const LoadCardToAdd = Command.define('LoadCardToAdd', {
  args: { cardId: Printing.CardId, isAdditionalLegend: Schema.Boolean },
  messages: [Message.SucceededLoadCardToAdd, Message.SkippedLoadCatalogue],
  execute: ({ cardId, isAdditionalLegend }) =>
    Effect.gen(function* () {
      const index = yield* CatalogueIndexResource.get
      return Option.match(CatalogueIndex.cardById(index, cardId), {
        onNone: () => Message.SkippedLoadCatalogue(),
        onSome: card =>
          Message.SucceededLoadCardToAdd({ card, isAdditionalLegend }),
      })
    }).pipe(
      Effect.catchTag('ResourceNotAvailable', () =>
        Effect.succeed(Message.SkippedLoadCatalogue()),
      ),
    ),
})

export const CopyDeckCode = Command.define('CopyDeckCode', {
  args: { code: DeckCode.DeckCode },
  messages: [Message.CompletedCopyDeckCode, Message.FailedCopyDeckCode],
  execute: ({ code }) =>
    Effect.tryPromise(() => navigator.clipboard.writeText(code)).pipe(
      Effect.as(Message.CompletedCopyDeckCode({ code })),
      Effect.catch(() => Effect.succeed(Message.FailedCopyDeckCode({ code }))),
    ),
})

// ROUTE

const printingIdsOf = (
  contents: Deck.DeckContents,
): ReadonlyArray<Printing.PrintingId> => [
  ...Option.toArray(contents.maybeLegend),
  ...Option.toArray(contents.maybeChosenChampion),
  ...Array.flatMap(
    [contents.main, contents.runes, contents.battlefields, contents.sideboard],
    Array.map(({ printingId }) => printingId),
  ),
  ...contents.additionalLegends,
]

const knownPrintings = (model: Model) =>
  HashSet.fromIterable(
    Array.flatMap(Record.values(model.cards), card =>
      Array.map(card.printings, ({ id }) => id),
    ),
  )

export const enter = (
  model: Model,
  maybeDeck: Option.Option<Deck.Deck>,
  isIndexReady: boolean,
): EnterReturn =>
  Option.match(maybeDeck, {
    onNone: () => ({ model }),
    onSome: deck => {
      const nextModel: Model = Option.exists(
        model.maybeDeckId,
        id => id === deck.id,
      )
        ? model
        : modifyFields(init(), {
            maybeDeckId: () => Option.some(deck.id),
            name: () => NotValidated({ value: deck.name }),
          })
      const known = knownPrintings(nextModel)
      const missing = Array.filter(
        printingIdsOf(deck.contents),
        printingId => !HashSet.has(known, printingId),
      )

      return isIndexReady && Array.isReadonlyArrayNonEmpty(missing)
        ? {
            model: nextModel,
            commands: [LoadDeckCards({ printingIds: missing })],
          }
        : { model: nextModel }
    },
  })

// UPDATE

const zoneOf = (place: DeckStructure.Place): Option.Option<Deck.Zone> =>
  place === 'Main' ||
  place === 'Runes' ||
  place === 'Battlefields' ||
  place === 'Sideboard'
    ? Option.some(place)
    : Option.none()

const stepEdits = (
  deck: Deck.Deck,
  place: DeckStructure.Place,
  printingId: Printing.PrintingId,
  step: DeckEdit.Step,
): ReadonlyArray<DeckEdit.DeckEdit> =>
  Option.match(zoneOf(place), {
    onSome: zone => [{ _tag: 'StepCopies', zone, printingId, step }],
    onNone: () => {
      if (place === 'Legend') {
        return step === 1
          ? [{ _tag: 'AddCard', printingId, maybeType: Option.some('Legend') }]
          : [{ _tag: 'ClearLegend' }]
      } else if (place === 'ChosenChampion') {
        return step === 1
          ? [{ _tag: 'MakeChampion', printingId }]
          : [{ _tag: 'ClearChampion' }]
      } else if (step === 1) {
        return [{ _tag: 'AddAdditionalLegend', printingId }]
      } else {
        return Option.toArray(
          Option.map(
            Array.findLastIndex(
              deck.contents.additionalLegends,
              legend => legend === printingId,
            ),
            position => ({ _tag: 'RemoveAdditionalLegend', position }),
          ),
        )
      }
    },
  })

const edited = (
  model: Model,
  maybeDeck: Option.Option<Deck.Deck>,
  edits: (deck: Deck.Deck) => ReadonlyArray<DeckEdit.DeckEdit>,
): UpdateReturn =>
  Option.match(maybeDeck, {
    onNone: () => ({ model }),
    onSome: deck =>
      Array.match(edits(deck), {
        onEmpty: () => ({ model }),
        onNonEmpty: nonEmpty => ({
          model,
          outMessage: OutMessage.EditedDeck({
            deckId: deck.id,
            edits: nonEmpty,
          }),
        }),
      }),
  })

const foldCardPanel = (
  place: DeckStructure.Place,
  maybeDeck: Option.Option<Deck.Deck>,
) =>
  Update.foldChild({
    update: CardPanel.update,
    read: (model: Model) => Option.some(model.panels[place]),
    write: (model: Model, nextPanel: CardPanel.Model): Model =>
      modifyFields(model, {
        panels: panels => Record.set(panels, place, nextPanel),
      }),
    toParentMessage: message =>
      Message.GotCardPanelMessage({ panelId: place, message }),
    toParentOutMessage: CardPanel.OutMessage.match<OutMessage | undefined>({
      SteppedQuantity: ({ printingId, step }) =>
        Option.getOrUndefined(
          Option.flatMap(maybeDeck, deck =>
            Array.match(stepEdits(deck, place, printingId, step), {
              onEmpty: () => Option.none<OutMessage>(),
              onNonEmpty: edits =>
                Option.some(OutMessage.EditedDeck({ deckId: deck.id, edits })),
            }),
          ),
        ),
      RequestedCollectionRetry: () => undefined,
    }),
  })

export const update =
  (maybeDeck: Option.Option<Deck.Deck>) => (model: Model, message: Message) =>
    Message.match<UpdateReturn>(message, {
      UpdatedName: ({ value }) => {
        const nextModel: Model = modifyFields(model, {
          name: () => validateName(value),
        })

        return Option.match(Deck.parseName(value), {
          onNone: () => ({ model: nextModel }),
          onSome: name =>
            edited(nextModel, maybeDeck, () => [{ _tag: 'Rename', name }]),
        })
      },

      UpdatedSearch: ({ value }) => {
        const term = String.trim(value)
        const nextModel: Model = modifyFields(model, {
          searchText: () => value,
          searchResults: results => (String.isEmpty(term) ? [] : results),
        })

        return String.isEmpty(term)
          ? { model: nextModel }
          : { model: nextModel, commands: [SearchCardsToAdd({ term })] }
      },

      SucceededSearchCardsToAdd: ({ term, cards }) =>
        term === String.trim(model.searchText)
          ? { model: modifyFields(model, { searchResults: () => cards }) }
          : { model },

      ClickedAddCard: ({ cardId, isAdditionalLegend }) => ({
        model,
        commands: [LoadCardToAdd({ cardId, isAdditionalLegend })],
      }),

      SucceededLoadCardToAdd: ({ card, isAdditionalLegend }) => {
        const base = Printing.basePrinting(card)

        return edited(
          modifyFields(model, {
            cards: cards => Record.set(cards, card.id, card),
          }),
          maybeDeck,
          () => [
            isAdditionalLegend
              ? { _tag: 'AddAdditionalLegend', printingId: base.id }
              : {
                  _tag: 'AddCard',
                  printingId: base.id,
                  maybeType: base.maybeType,
                },
          ],
        )
      },

      SucceededLoadDeckCards: ({ cards }) => ({
        model: modifyFields(model, {
          cards: existing =>
            Array.reduce(cards, existing, (known, card) =>
              Record.set(known, card.id, card),
            ),
        }),
      }),

      SkippedLoadCatalogue: () => ({ model }),

      GotCardPanelMessage: ({ panelId, message }) =>
        foldCardPanel(panelId, maybeDeck)(model, message),

      ClickedMoveLine: ({ from, to, printingIds }) =>
        edited(model, maybeDeck, () =>
          Array.map(printingIds, printingId => ({
            _tag: 'MoveCard',
            from,
            to,
            printingId,
          })),
        ),

      ClickedMakeChampion: ({ printingId }) =>
        edited(model, maybeDeck, () => [{ _tag: 'MakeChampion', printingId }]),

      ClickedClearLegend: () =>
        edited(model, maybeDeck, () => [{ _tag: 'ClearLegend' }]),

      ClickedClearChampion: () =>
        edited(model, maybeDeck, () => [{ _tag: 'ClearChampion' }]),

      ClickedRemoveAdditionalLegend: ({ position }) =>
        edited(model, maybeDeck, () => [
          { _tag: 'RemoveAdditionalLegend', position },
        ]),

      ClickedCopyCode: () =>
        Option.match(maybeDeck, {
          onNone: () => ({ model }),
          onSome: deck =>
            Result.match(DeckCode.encode(deck.contents), {
              onSuccess: code => ({
                model,
                commands: [CopyDeckCode({ code })],
              }),
              onFailure: problem => ({
                model: modifyFields(model, {
                  export: () => Export.NotEncodable({ problem }),
                }),
              }),
            }),
        }),

      CompletedCopyDeckCode: ({ code }) => ({
        model: modifyFields(model, { export: () => Export.Copied({ code }) }),
      }),

      FailedCopyDeckCode: ({ code }) => ({
        model: modifyFields(model, {
          export: () => Export.CopyFailed({ code }),
        }),
      }),

      ClickedDelete: () => ({
        model: modifyFields(model, { isConfirmingDelete: () => true }),
      }),

      ClickedCancelDelete: () => ({
        model: modifyFields(model, { isConfirmingDelete: () => false }),
      }),

      ClickedConfirmDelete: () =>
        Option.match(maybeDeck, {
          onNone: () => ({ model }),
          onSome: deck => ({
            model,
            outMessage: OutMessage.RequestedRemoveDeck({ deckId: deck.id }),
          }),
        }),

      ClickedRetryLoadDecks: () => ({
        model,
        outMessage: OutMessage.RequestedRetryLoadDecks(),
      }),
    })
