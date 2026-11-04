import {
  Array,
  Duration,
  Effect,
  HashSet,
  Match,
  Option,
  Record,
  Result,
  Schema,
  String,
} from 'effect'
import { Command, Dom, Update } from 'foldkit'
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
  DeckRules,
  type DeckStructure,
  Printing,
  Runes,
} from '../../../../domain'
import {
  CatalogueIndex,
  CatalogueIndexResource,
  type CatalogueIndexService,
  Clipboard,
} from '../../../../service'
import { Tabs, Toast } from '../../../../ui'
import * as CardPanel from '../../cardPanel'
import { copyStepOf } from './copies'
import { cardsByPrinting, nameOf } from './lines'
import { Message, OutMessage } from './message'
import {
  AddTab,
  AddTarget,
  Export,
  type Model,
  type SidePanel,
  SideTabs,
  TAB_FOR_SECTION,
  defaultTab,
  init,
  sectionElementId,
} from './model'

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
    target: AddTarget,
  },
  messages: [Message.SucceededLoadCardToAdd, Message.SkippedLoadCatalogue],
  execute: ({ cardId, tab, target }) =>
    Effect.gen(function* () {
      const index = yield* CatalogueIndexResource.get
      return Option.match(CatalogueIndex.cardById(index, cardId), {
        onNone: () => Message.SkippedLoadCatalogue(),
        onSome: card => Message.SucceededLoadCardToAdd({ card, tab, target }),
      })
    }).pipe(
      Effect.catchTag('ResourceNotAvailable', () =>
        Effect.succeed(Message.SkippedLoadCatalogue()),
      ),
    ),
})

const UNDO_DURATION = Duration.seconds(8)

export const WaitBeforeClearingUndo = Command.define('WaitBeforeClearingUndo', {
  args: { id: Schema.Int },
  messages: [Message.CompletedWaitBeforeClearingUndo],
  execute: ({ id }) =>
    Effect.sleep(UNDO_DURATION).pipe(
      Effect.as(Message.CompletedWaitBeforeClearingUndo({ id })),
    ),
})

export const FindRunes = Command.define('FindRunes', {
  args: { domains: Schema.Array(Printing.Domain) },
  messages: [Message.SucceededFindRunes, Message.SkippedLoadCatalogue],
  execute: ({ domains }) =>
    Effect.gen(function* () {
      const index = yield* CatalogueIndexResource.get
      const found = yield* Effect.forEach(domains, domain =>
        CatalogueIndex.searchCards(
          index,
          { ...CatalogueQuery.empty, type: ['Rune'], domain: [domain] },
          1,
          [],
        ),
      )

      return Message.SucceededFindRunes({
        cards: Array.getSomes(
          Array.map(
            Array.flatMap(found, ({ cards }) => cards),
            ({ id }) => CatalogueIndex.cardById(index, id),
          ),
        ),
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
    Clipboard.writeText(code).pipe(
      Effect.as(Message.CompletedCopyDeckCode({ code })),
      Effect.catch(() => Effect.succeed(Message.FailedCopyDeckCode({ code }))),
    ),
})

export const ScrollToSection = Command.define('ScrollToSection', {
  args: { section: DeckRules.Section },
  messages: [Message.CompletedScrollToSection],
  execute: ({ section }) =>
    Dom.scrollIntoView(`#${sectionElementId(section)}`, {
      block: 'start',
    }).pipe(Effect.ignore, Effect.as(Message.CompletedScrollToSection())),
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

// SIDE TABS

const foldSideTabsOutMessage = Tabs.OutMessage.match<
  Update.Step<Model, Message>,
  Tabs.OutMessage<SidePanel>
>({
  Selected:
    ({ value }) =>
    stepModel => ({
      model: modifyFields(stepModel, {
        sidePanel: () => value,
        isSheetOpen: () => true,
      }),
    }),
})

const foldSideTabs = Update.foldChild({
  update: SideTabs.update,
  read: (model: Model) => Option.some(model.sideTabs),
  write: (model: Model, nextSideTabs: Tabs.Model): Model =>
    modifyFields(model, { sideTabs: () => nextSideTabs }),
  toParentMessage: (message: Tabs.Message) =>
    Message.GotSideTabsMessage({ message }),
  foldOutMessage: foldSideTabsOutMessage,
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

export type CopyInfo = Readonly<{
  printingIds: ReadonlyArray<Printing.PrintingId>
  maybeLimit: Option.Option<number>
}>

export const copyInfoOf = (
  model: Model,
  cardId: Printing.CardId,
): Option.Option<CopyInfo> =>
  Option.orElse(
    Option.map(Record.get(model.cards, cardId), card => ({
      printingIds: Array.map(card.printings, ({ id }) => id),
      maybeLimit: DeckRules.copyLimitOf(Printing.basePrinting(card)),
    })),
    () =>
      Option.map(
        Array.findFirst(model.searchResults, ({ id }) => id === cardId),
        summary => ({
          printingIds: summary.printingIds,
          maybeLimit: summary.maybeCopyLimit,
        }),
      ),
  )

const legendOf = (
  model: Model,
  maybeDeck: Option.Option<Deck.Deck>,
): Option.Option<Printing.Printing> => {
  const byPrinting = cardsByPrinting(model.cards)

  return Option.flatMap(
    Option.flatMap(maybeDeck, ({ contents }) => contents.maybeLegend),
    legendId =>
      Option.flatMap(Option.fromNullishOr(byPrinting.get(legendId)), card =>
        Array.findFirst(card.printings, ({ id }) => id === legendId),
      ),
  )
}

const domainFinder = (model: Model) => {
  const byPrinting = cardsByPrinting(model.cards)

  return (printingId: Printing.PrintingId): Option.Option<Printing.Domain> =>
    Option.flatMap(Option.fromNullishOr(byPrinting.get(printingId)), card =>
      Array.head(Printing.basePrinting(card).domains),
    )
}

const runeChoicesOf = (
  legend: Printing.Printing,
  runeCards: ReadonlyArray<Printing.Card>,
): ReadonlyArray<Runes.RuneChoice> =>
  Array.filterMap(legend.domains, domain =>
    Result.fromOption(
      Option.map(
        Array.findFirst(runeCards, card =>
          Array.contains(Printing.basePrinting(card).domains, domain),
        ),
        card => ({ domain, printingId: Printing.basePrinting(card).id }),
      ),
      () => domain,
    ),
  )

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

const withUndo = (
  result: UpdateReturn,
  text: string,
  maybeEdits: Option.Option<Array.NonEmptyReadonlyArray<DeckEdit.DeckEdit>>,
): UpdateReturn =>
  Option.match(maybeEdits, {
    onNone: () => result,
    onSome: edits =>
      result.outMessage === undefined
        ? result
        : {
            ...result,
            model: modifyFields(result.model, {
              maybeUndo: () =>
                Option.some({ id: result.model.nextUndoId, text, edits }),
              nextUndoId: id => id + 1,
            }),
            commands: [
              ...(result.commands ?? []),
              WaitBeforeClearingUndo({ id: result.model.nextUndoId }),
            ],
          },
  })

const nameOfPrinting = (
  model: Model,
  printingId: Printing.PrintingId,
): string =>
  Option.match(
    Option.fromNullishOr(cardsByPrinting(model.cards).get(printingId)),
    { onNone: () => printingId, onSome: nameOf },
  )

const removalUndo = (
  deck: Deck.Deck,
  edits: Array.NonEmptyReadonlyArray<DeckEdit.DeckEdit>,
): Option.Option<
  Readonly<{
    printingId: Printing.PrintingId
    zone: Deck.Zone
    edits: Array.NonEmptyReadonlyArray<DeckEdit.DeckEdit>
  }>
> => {
  const [edit, ...rest] = edits

  return edit._tag === 'StepCopies' &&
    edit.step === -1 &&
    Array.isReadonlyArrayEmpty(rest) &&
    DeckEdit.copiesOf(deck.contents, edit.zone, edit.printingId) === 1
    ? Option.some({
        printingId: edit.printingId,
        zone: edit.zone,
        edits: [
          {
            _tag: 'StepCopies',
            zone: edit.zone,
            printingId: edit.printingId,
            step: 1,
          },
        ],
      })
    : Option.none()
}

const ZONE_NAMES: Readonly<Record<Deck.Zone, string>> = {
  Main: 'the main deck',
  Runes: 'the runes',
  Battlefields: 'the battlefields',
  Sideboard: 'the sideboard',
}

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

const editFor = (
  tab: AddTab,
  target: AddTarget,
  card: Printing.Card,
): DeckEdit.DeckEdit => {
  const base = Printing.basePrinting(card)

  if (target === 'Sideboard') {
    return {
      _tag: 'StepCopies',
      zone: 'Sideboard',
      printingId: base.id,
      step: 1,
    }
  }

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

export const isChoiceTab = (tab: AddTab): boolean =>
  tab === 'Legend' || tab === 'Champion' || tab === 'AdditionalLegend'

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

const foldCardPanel = (place: DeckStructure.Place) =>
  Update.foldChild({
    update: CardPanel.update,
    read: (model: Model) => Option.some(model.panels[place]),
    write: (model: Model, nextPanel: CardPanel.Model): Model =>
      modifyFields(model, {
        panels: panels => Record.set(panels, place, nextPanel),
      }),
    toParentMessage: message =>
      Message.GotCardPanelMessage({ panelId: place, message }),
    toParentOutMessage: CardPanel.OutMessage.match<OutMessage>({
      SteppedQuantity: ({ printingId, step }) =>
        OutMessage.SteppedOwned({ printingId, step }),
      RequestedCollectionRetry: () => OutMessage.RequestedCollectionRetry(),
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
          sidePanel: () => 'Add',
          isSheetOpen: () => true,
        })
        return {
          model: nextModel,
          commands: [searchFor(nextModel, maybeDeck)],
        }
      },

      ClickedProgress: ({ section }) => {
        const tab = TAB_FOR_SECTION[section]
        const nextModel = modifyFields(model, {
          addTab: () => tab,
          searchResults: results => (tab === model.addTab ? results : []),
          sidePanel: () => 'Add',
          isSheetOpen: () => true,
        })

        return {
          model: nextModel,
          commands: [
            ScrollToSection({ section }),
            ...(tab === model.addTab ? [] : [searchFor(nextModel, maybeDeck)]),
          ],
        }
      },

      CompletedScrollToSection: () => ({ model }),

      ClickedToggleSheet: () => ({
        model: modifyFields(model, { isSheetOpen: isOpen => !isOpen }),
      }),

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

      ClickedStepCopies: ({ cardId, maybeVersion, zone, step }) =>
        Option.match(
          Option.flatMap(maybeDeck, deck =>
            Option.flatMap(
              copyInfoOf(model, cardId),
              ({ printingIds, maybeLimit }) =>
                copyStepOf(
                  deck.contents,
                  zone,
                  printingIds,
                  maybeLimit,
                  step,
                  maybeVersion,
                ),
            ),
          ),
          {
            onNone: () => ({ model }),
            onSome: copyStep =>
              copyStep._tag === 'LoadCard'
                ? {
                    model,
                    commands: [
                      LoadCardToAdd({
                        cardId,
                        tab: model.addTab,
                        target: zone === 'Sideboard' ? 'Sideboard' : 'Deck',
                      }),
                    ],
                  }
                : Option.match(
                    Option.flatMap(maybeDeck, deck =>
                      removalUndo(deck, copyStep.edits),
                    ),
                    {
                      onNone: () =>
                        edited(model, maybeDeck, () => copyStep.edits),
                      onSome: removal =>
                        withUndo(
                          edited(model, maybeDeck, () => copyStep.edits),
                          `Removed ${nameOfPrinting(model, removal.printingId)} from ${ZONE_NAMES[removal.zone]}.`,
                          Option.some(removal.edits),
                        ),
                    },
                  ),
          },
        ),

      ClickedAddCard: ({ cardId, target }) => ({
        model,
        commands: [LoadCardToAdd({ cardId, tab: model.addTab, target })],
      }),

      SucceededLoadCardToAdd: ({ card, tab, target }) => {
        const nextTab = tabAfter(tab, maybeDeck)
        const stored: Model = modifyFields(model, {
          cards: cards => Record.set(cards, card.id, card),
          addTab: () => nextTab,
          searchResults: results => (nextTab === tab ? results : []),
        })
        const toastShow = isChoiceTab(tab)
          ? showToast(stored, {
              variant: 'Success',
              payload: { text: addedText(tab, card) },
            })
          : { model: stored }
        const edit = edited(toastShow.model, maybeDeck, () => [
          editFor(tab, target, card),
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
        foldCardPanel(panelId)(model, message),

      GotToastMessage: ({ message }) => foldToast(model, message),

      GotSideTabsMessage: ({ message }) => foldSideTabs(model, message),

      ClickedStepLine: ({ zone, printingId, step }) =>
        edited(model, maybeDeck, () => [
          { _tag: 'StepCopies', zone, printingId, step },
        ]),

      SelectedVersion: ({ zone, from, value }) =>
        Option.match(Schema.decodeOption(Printing.PrintingId)(value), {
          onNone: () => ({ model }),
          onSome: to =>
            edited(model, maybeDeck, deck =>
              to === from
                ? []
                : Array.flatten(
                    Array.makeBy(
                      DeckEdit.copiesOf(deck.contents, zone, from),
                      (): ReadonlyArray<DeckEdit.DeckEdit> => [
                        {
                          _tag: 'StepCopies',
                          zone,
                          printingId: from,
                          step: -1,
                        },
                        { _tag: 'StepCopies', zone, printingId: to, step: 1 },
                      ],
                    ),
                  ),
            ),
        }),

      SelectedSlotVersion: ({ place, value }) =>
        Option.match(Schema.decodeOption(Printing.PrintingId)(value), {
          onNone: () => ({ model }),
          onSome: printingId =>
            edited(model, maybeDeck, () => [
              place === 'Legend'
                ? {
                    _tag: 'AddCard',
                    printingId,
                    maybeType: Option.some('Legend'),
                  }
                : { _tag: 'SetChampion', printingId },
            ]),
        }),

      ClickedMakeChampion: ({ printingId }) =>
        edited(model, maybeDeck, () => [{ _tag: 'MakeChampion', printingId }]),

      ClickedClearLegend: () => {
        const maybeLegend = Option.flatMap(
          maybeDeck,
          ({ contents }) => contents.maybeLegend,
        )

        return withUndo(
          edited(model, maybeDeck, () => [{ _tag: 'ClearLegend' }]),
          `Removed the legend ${Option.match(maybeLegend, {
            onNone: () => '',
            onSome: printingId => nameOfPrinting(model, printingId),
          })}.`,
          Option.map(
            maybeLegend,
            (printingId): Array.NonEmptyReadonlyArray<DeckEdit.DeckEdit> => [
              {
                _tag: 'AddCard',
                printingId,
                maybeType: Option.some('Legend'),
              },
            ],
          ),
        )
      },

      ClickedClearChampion: () => {
        const maybeChampion = Option.flatMap(
          maybeDeck,
          ({ contents }) => contents.maybeChosenChampion,
        )

        return withUndo(
          edited(model, maybeDeck, () => [{ _tag: 'ClearChampion' }]),
          `${Option.match(maybeChampion, {
            onNone: () => 'The champion',
            onSome: printingId => nameOfPrinting(model, printingId),
          })} is no longer the chosen champion; it is back in the main deck.`,
          Option.map(
            maybeChampion,
            (printingId): Array.NonEmptyReadonlyArray<DeckEdit.DeckEdit> => [
              { _tag: 'MakeChampion', printingId },
            ],
          ),
        )
      },

      ClickedRemoveAdditionalLegend: ({ position }) => {
        const maybeLegend = Option.flatMap(maybeDeck, ({ contents }) =>
          Array.get(contents.additionalLegends, position),
        )

        return withUndo(
          edited(model, maybeDeck, () => [
            { _tag: 'RemoveAdditionalLegend', position },
          ]),
          `Removed ${Option.match(maybeLegend, {
            onNone: () => 'the additional legend',
            onSome: printingId => nameOfPrinting(model, printingId),
          })}.`,
          Option.map(
            maybeLegend,
            (printingId): Array.NonEmptyReadonlyArray<DeckEdit.DeckEdit> => [
              { _tag: 'AddAdditionalLegend', printingId },
            ],
          ),
        )
      },

      ClickedUndo: () =>
        Option.match(model.maybeUndo, {
          onNone: () => ({ model }),
          onSome: ({ edits }) =>
            edited(
              modifyFields(model, { maybeUndo: () => Option.none() }),
              maybeDeck,
              () => edits,
            ),
        }),

      ClickedDismissUndo: () => ({
        model: modifyFields(model, { maybeUndo: () => Option.none() }),
      }),

      CompletedWaitBeforeClearingUndo: ({ id }) => ({
        model: modifyFields(model, {
          maybeUndo: maybeUndo =>
            Option.filter(maybeUndo, undo => undo.id !== id),
        }),
      }),

      ClickedSplitRunes: () =>
        Option.match(legendOf(model, maybeDeck), {
          onNone: () => ({ model }),
          onSome: legend => ({
            model,
            commands: [FindRunes({ domains: legend.domains })],
          }),
        }),

      SucceededFindRunes: ({ cards }) => {
        const nextModel = modifyFields(model, {
          cards: existing =>
            Array.reduce(cards, existing, (known, card) =>
              Record.set(known, card.id, card),
            ),
        })

        return edited(nextModel, maybeDeck, deck =>
          Option.match(legendOf(nextModel, maybeDeck), {
            onNone: () => [],
            onSome: legend =>
              Runes.splitEvenly(
                deck.contents.runes,
                runeChoicesOf(legend, cards),
                domainFinder(nextModel),
              ),
          }),
        )
      },

      ClickedDuplicate: () =>
        Option.match(maybeDeck, {
          onNone: () => ({ model }),
          onSome: deck => ({
            model,
            outMessage: OutMessage.RequestedDuplicateDeck({
              name: Option.getOrElse(
                Deck.parseName(`${deck.name} (copy)`),
                () => deck.name,
              ),
              contents: deck.contents,
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
