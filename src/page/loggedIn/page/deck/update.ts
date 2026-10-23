import {
  Array,
  Effect,
  HashSet,
  Match,
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
  DeckEdit,
  type DeckStructure,
  Printing,
} from '../../../../domain'
import {
  CatalogueIndex,
  CatalogueIndexResource,
  type CatalogueIndexService,
} from '../../../../service'
import { Toast } from '../../../../ui'
import * as CardPanel from '../../cardPanel'
import { cardsByPrinting, nameOf } from './lines'
import { Message, OutMessage } from './message'
import { AddTab, Export, type Model, defaultTab, init } from './model'

type UpdateReturn = Update.ReturnWithOutMessage<
  Model,
  Message,
  OutMessage,
  CatalogueIndexService
>
type EnterReturn = Update.Return<Model, Message, CatalogueIndexService>

const RESULTS_LIMIT = 60

const ZONE_LABELS: Readonly<Record<Deck.Zone, string>> = {
  Main: 'the main deck',
  Runes: 'the rune deck',
  Battlefields: 'the battlefields',
  Sideboard: 'the sideboard',
}

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

const queryFor = (
  tab: AddTab,
  term: string,
  legendTags: ReadonlyArray<string>,
): CatalogueQuery.Query => {
  const searched = CatalogueQuery.withTerm(CatalogueQuery.empty, term)

  return Match.value(tab).pipe(
    Match.withReturnType<CatalogueQuery.Query>(),
    Match.when('Legend', () => ({ ...searched, type: ['Legend'] })),
    Match.when('AdditionalLegend', () => ({ ...searched, type: ['Legend'] })),
    Match.when('Champion', () => ({
      ...searched,
      type: ['Unit'],
      supertype: ['Champion'],
      tag: legendTags,
    })),
    Match.orElse(type => ({ ...searched, type: [type] })),
  )
}

export const SearchCardsToAdd = Command.define('SearchCardsToAdd', {
  args: {
    term: Schema.String,
    tab: AddTab,
    legendTags: Schema.Array(Schema.String),
  },
  messages: [Message.SucceededSearchCardsToAdd, Message.SkippedLoadCatalogue],
  execute: ({ term, tab, legendTags }) =>
    Effect.gen(function* () {
      const index = yield* CatalogueIndexResource.get
      const result = yield* CatalogueIndex.searchCards(
        index,
        queryFor(tab, term, legendTags),
        RESULTS_LIMIT,
        [],
      )
      return Message.SucceededSearchCardsToAdd({
        term,
        tab,
        cards: result.cards,
      })
    }).pipe(
      Effect.catchTag('ResourceNotAvailable', () =>
        Effect.succeed(Message.SkippedLoadCatalogue()),
      ),
    ),
})

export const LoadCardToAdd = Command.define('LoadCardToAdd', {
  args: {
    cardId: Printing.CardId,
    tab: AddTab,
  },
  messages: [Message.SucceededLoadCardToAdd, Message.SkippedLoadCatalogue],
  execute: ({ cardId, tab }) =>
    Effect.gen(function* () {
      const index = yield* CatalogueIndexResource.get
      return Option.match(CatalogueIndex.cardById(index, cardId), {
        onNone: () => Message.SkippedLoadCatalogue(),
        onSome: card => Message.SucceededLoadCardToAdd({ card, tab }),
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

// SEARCH

const legendTagsOf = (
  model: Model,
  maybeDeck: Option.Option<Deck.Deck>,
): ReadonlyArray<string> => {
  const byPrinting = cardsByPrinting(model.cards)

  return Option.match(
    Option.flatMap(maybeDeck, ({ contents }) => contents.maybeLegend),
    {
      onNone: () => [],
      onSome: legendId =>
        Option.match(Option.fromNullishOr(byPrinting.get(legendId)), {
          onNone: () => [],
          onSome: card => Printing.basePrinting(card).tags,
        }),
    },
  )
}

const searchFor = (model: Model, maybeDeck: Option.Option<Deck.Deck>) =>
  SearchCardsToAdd({
    term: String.trim(model.searchText),
    tab: model.addTab,
    legendTags: legendTagsOf(model, maybeDeck),
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
            addTab: () => defaultTab(deck.contents),
          })
      const known = knownPrintings(nextModel)
      const missing = Array.filter(
        printingIdsOf(deck.contents),
        printingId => !HashSet.has(known, printingId),
      )

      return isIndexReady
        ? {
            model: nextModel,
            commands: [
              searchFor(nextModel, maybeDeck),
              ...(Array.isReadonlyArrayNonEmpty(missing)
                ? [LoadDeckCards({ printingIds: missing })]
                : []),
            ],
          }
        : { model: nextModel }
    },
  })

// EDITS

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
          ? [{ _tag: 'SetChampion', printingId }]
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

const editFor = (tab: AddTab, card: Printing.Card): DeckEdit.DeckEdit => {
  const base = Printing.basePrinting(card)

  return Match.value(tab).pipe(
    Match.withReturnType<DeckEdit.DeckEdit>(),
    Match.when('Legend', () => ({
      _tag: 'AddCard',
      printingId: base.id,
      maybeType: Option.some('Legend'),
    })),
    Match.when('AdditionalLegend', () => ({
      _tag: 'AddAdditionalLegend',
      printingId: base.id,
    })),
    Match.when('Champion', () => ({
      _tag: 'SetChampion',
      printingId: base.id,
    })),
    Match.orElse(() => ({
      _tag: 'AddCard',
      printingId: base.id,
      maybeType: base.maybeType,
    })),
  )
}

const addedText = (tab: AddTab, card: Printing.Card): string => {
  const name = nameOf(card)

  return Match.value(tab).pipe(
    Match.withReturnType<string>(),
    Match.when('Legend', () => `${name} is the legend.`),
    Match.when('Champion', () => `${name} is the chosen champion.`),
    Match.when(
      'AdditionalLegend',
      () => `Added ${name} as an additional legend.`,
    ),
    Match.orElse(
      () =>
        `Added ${name} to ${ZONE_LABELS[DeckEdit.zoneForType(Printing.basePrinting(card).maybeType)]}.`,
    ),
  )
}

const tabAfter = (tab: AddTab, maybeDeck: Option.Option<Deck.Deck>): AddTab => {
  const hasChampion = Option.exists(maybeDeck, ({ contents }) =>
    Option.isSome(contents.maybeChosenChampion),
  )

  if (tab === 'Legend') {
    return hasChampion ? 'Unit' : 'Champion'
  } else if (tab === 'Champion') {
    return 'Unit'
  } else {
    return tab
  }
}

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

// UPDATE

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
        const nextModel = modifyFields(model, { searchText: () => value })
        return { model: nextModel, commands: [searchFor(nextModel, maybeDeck)] }
      },

      SelectedAddTab: ({ tab }) => {
        const nextModel = modifyFields(model, {
          addTab: () => tab,
          searchResults: () => [],
        })
        return { model: nextModel, commands: [searchFor(nextModel, maybeDeck)] }
      },

      ToggledOnlyLegal: ({ isChecked }) => ({
        model: modifyFields(model, { isOnlyLegal: () => isChecked }),
      }),

      SelectedLayout: ({ layout }) => ({
        model: modifyFields(model, { layout: () => layout }),
      }),

      SucceededSearchCardsToAdd: ({ term, tab, cards }) =>
        term === String.trim(model.searchText) && tab === model.addTab
          ? { model: modifyFields(model, { searchResults: () => cards }) }
          : { model },

      ClickedAddCard: ({ cardId }) => ({
        model,
        commands: [LoadCardToAdd({ cardId, tab: model.addTab })],
      }),

      SucceededLoadCardToAdd: ({ card, tab }) => {
        const nextTab = tabAfter(tab, maybeDeck)
        const stored: Model = modifyFields(model, {
          cards: cards => Record.set(cards, card.id, card),
          addTab: () => nextTab,
          searchResults: results => (nextTab === tab ? results : []),
        })
        const toastShow = showToast(stored, {
          variant: 'Success',
          payload: { text: addedText(tab, card) },
        })
        const edit = edited(toastShow.model, maybeDeck, () => [
          editFor(tab, card),
        ])

        return {
          model: edit.model,
          commands: [
            ...(toastShow.commands ?? []),
            ...(nextTab === tab ? [] : [searchFor(edit.model, maybeDeck)]),
          ],
          ...(edit.outMessage === undefined
            ? {}
            : { outMessage: edit.outMessage }),
        }
      },

      SucceededLoadDeckCards: ({ cards }) => {
        const nextModel = modifyFields(model, {
          cards: existing =>
            Array.reduce(cards, existing, (known, card) =>
              Record.set(known, card.id, card),
            ),
        })

        return nextModel.addTab === 'Champion'
          ? { model: nextModel, commands: [searchFor(nextModel, maybeDeck)] }
          : { model: nextModel }
      },

      SkippedLoadCatalogue: () => ({ model }),

      GotCardPanelMessage: ({ panelId, message }) =>
        foldCardPanel(panelId, maybeDeck)(model, message),

      GotToastMessage: ({ message }) => foldToast(model, message),

      ClickedStepLine: ({ zone, printingId, step }) =>
        edited(model, maybeDeck, () => [
          { _tag: 'StepCopies', zone, printingId, step },
        ]),

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

      ClickedSendMissing: ({ lines }) =>
        Option.match(maybeDeck, {
          onNone: () => ({ model }),
          onSome: deck => ({
            model,
            outMessage: OutMessage.RequestedSendMissing({
              deckId: deck.id,
              deckName: deck.name,
              lines,
            }),
          }),
        }),

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
