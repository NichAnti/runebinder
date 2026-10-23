import { Array, Match, Option, Record } from 'effect'
import { Submodel } from 'foldkit'
import type { Html, HtmlBuilder } from 'foldkit/html'

import {
  type CatalogueSearch,
  Deck,
  type DeckStructure,
  type Printing,
} from '../../../../domain'
import { decksRouter } from '../../../../route'
import { Button, Link, Notice, SearchField, TextField } from '../../../../ui'
import * as CardPanel from '../../cardPanel'
import * as DecksState from '../../decks'
import * as Printings from '../../printings'
import { problemText } from '../deckList/view'
import {
  type Line,
  cardsByPrinting,
  isChampionUnit,
  linesOf,
  nameOf,
  quantitiesOf,
} from './lines'
import { Message } from './message'
import type { Model } from './model'

export type ViewInputs = Readonly<{
  decks: DecksState.Model
  deckId: Deck.DeckId
}>

const PLACE_LABELS: Readonly<Record<DeckStructure.Place, string>> = {
  Legend: 'Legend',
  ChosenChampion: 'Chosen champion',
  Main: 'Main deck',
  Runes: 'Runes',
  Battlefields: 'Battlefields',
  Sideboard: 'Sideboard',
  AdditionalLegends: 'Additional legends',
}

const smallButton = (
  content: string,
  onClick: Message,
  h: HtmlBuilder<Message>,
): Html => Button.view({ content: [content], variant: 'Secondary', onClick }, h)

const panelLineView = (
  model: Model,
  place: DeckStructure.Place,
  card: Printing.Card,
  text: string,
  quantities: Readonly<Record<string, number>>,
  max: number,
  h: HtmlBuilder<Message>,
): Html =>
  h.submodel({
    slotId: `deck-${place}-${card.id}`,
    model: model.panels[place],
    view: CardPanel.tileView,
    viewInputs: {
      cardId: card.id,
      label: nameOf(card),
      trigger: { _tag: 'Line', content: [text] },
      counts: Printings.Counts.Ready({ kind: 'InDeck', quantities, max }),
    },
    toParentMessage: message =>
      Message.GotCardPanelMessage({ panelId: place, message }),
  })

const lineRow = (
  key: string,
  main: Html,
  actions: ReadonlyArray<Html>,
  h: HtmlBuilder<Message>,
): Html =>
  h.keyed('li')(
    key,
    [h.Class('flex items-center justify-between gap-3')],
    [h.div([h.Class('min-w-0 flex-1')], [main]), ...actions],
  )

const zoneLineView = (
  model: Model,
  zone: Deck.Zone,
  line: Line,
  h: HtmlBuilder<Message>,
): Html => {
  const text = `${line.copies}× ${line.label}`
  const quantities = Record.fromEntries(
    Array.map(line.cards, ({ printingId, copies }) => [printingId, copies]),
  )
  const printingIds = Array.map(line.cards, ({ printingId }) => printingId)
  const actions = Match.value(zone).pipe(
    Match.withReturnType<ReadonlyArray<Html>>(),
    Match.when('Main', () => [
      ...(Option.exists(line.maybeCard, isChampionUnit)
        ? [
            smallButton(
              'Make champion',
              Message.ClickedMakeChampion({
                printingId: Array.headNonEmpty(line.cards).printingId,
              }),
              h,
            ),
          ]
        : []),
      smallButton(
        'To sideboard',
        Message.ClickedMoveLine({ from: 'Main', to: 'Sideboard', printingIds }),
        h,
      ),
    ]),
    Match.when('Sideboard', () => [
      smallButton(
        'To main',
        Message.ClickedMoveLine({ from: 'Sideboard', to: 'Main', printingIds }),
        h,
      ),
    ]),
    Match.orElse(() => []),
  )

  return lineRow(
    line.key,
    Option.match(line.maybeCard, {
      onNone: () => h.span([h.Class('text-sm')], [text]),
      onSome: card =>
        panelLineView(model, zone, card, text, quantities, Deck.MAX_COPIES, h),
    }),
    actions,
    h,
  )
}

const sectionView = (
  title: string,
  count: Option.Option<number>,
  content: Html,
  h: HtmlBuilder<Message>,
): Html =>
  h.section(
    [h.AriaLabel(title), h.Class('flex flex-col gap-2')],
    [
      h.h2(
        [h.Class('flex items-baseline gap-2 text-base font-semibold')],
        [
          title,
          ...Option.match(count, {
            onNone: () => [],
            onSome: value => [
              h.span(
                [h.Class('text-sm font-normal text-fg-muted tabular-nums')],
                [`${value}`],
              ),
            ],
          }),
        ],
      ),
      content,
    ],
  )

const emptyLine = (text: string, h: HtmlBuilder<Message>): Html =>
  h.p([h.Class('text-sm text-fg-muted')], [text])

const zoneSectionView = (
  model: Model,
  zone: Deck.Zone,
  zoneCards: ReadonlyArray<Deck.DeckCard>,
  byPrinting: ReadonlyMap<string, Printing.Card>,
  h: HtmlBuilder<Message>,
): Html =>
  sectionView(
    PLACE_LABELS[zone],
    Option.some(Deck.copiesIn(zoneCards)),
    Array.match(linesOf(zoneCards, byPrinting), {
      onEmpty: () => emptyLine('Nothing here yet.', h),
      onNonEmpty: lines =>
        h.ul(
          [h.Class('flex flex-col gap-1')],
          Array.map(lines, line => zoneLineView(model, zone, line, h)),
        ),
    }),
    h,
  )

const slotSectionView = (
  model: Model,
  place: 'Legend' | 'ChosenChampion',
  maybePrintingId: Option.Option<Printing.PrintingId>,
  onClear: Message,
  byPrinting: ReadonlyMap<string, Printing.Card>,
  h: HtmlBuilder<Message>,
): Html =>
  sectionView(
    PLACE_LABELS[place],
    Option.none(),
    Option.match(maybePrintingId, {
      onNone: () =>
        emptyLine(
          place === 'Legend'
            ? 'No legend yet. Search for one above.'
            : 'No chosen champion yet. Use Make champion on a champion in the main deck.',
          h,
        ),
      onSome: printingId =>
        h.ul(
          [],
          [
            lineRow(
              printingId,
              Option.match(Option.fromNullishOr(byPrinting.get(printingId)), {
                onNone: () => h.span([h.Class('text-sm')], [printingId]),
                onSome: card =>
                  panelLineView(
                    model,
                    place,
                    card,
                    nameOf(card),
                    { [printingId]: 1 },
                    1,
                    h,
                  ),
              }),
              [smallButton('Remove', onClear, h)],
              h,
            ),
          ],
        ),
    }),
    h,
  )

const additionalLegendsView = (
  model: Model,
  legends: ReadonlyArray<Printing.PrintingId>,
  byPrinting: ReadonlyMap<string, Printing.Card>,
  h: HtmlBuilder<Message>,
): Html =>
  Array.match(legends, {
    onEmpty: () => h.empty,
    onNonEmpty: nonEmpty =>
      sectionView(
        PLACE_LABELS.AdditionalLegends,
        Option.some(Array.length(nonEmpty)),
        h.ul(
          [h.Class('flex flex-col gap-1')],
          Array.map(nonEmpty, (printingId, position) =>
            lineRow(
              `${position}-${printingId}`,
              Option.match(Option.fromNullishOr(byPrinting.get(printingId)), {
                onNone: () => h.span([h.Class('text-sm')], [printingId]),
                onSome: card =>
                  panelLineView(
                    model,
                    'AdditionalLegends',
                    card,
                    nameOf(card),
                    quantitiesOf(legends),
                    Deck.MAX_COPIES,
                    h,
                  ),
              }),
              [
                smallButton(
                  'Remove',
                  Message.ClickedRemoveAdditionalLegend({ position }),
                  h,
                ),
              ],
              h,
            ),
          ),
        ),
        h,
      ),
  })

const resultView = (
  card: CatalogueSearch.CardSummary,
  h: HtmlBuilder<Message>,
): Html => {
  const isLegend = Option.exists(card.maybeType, type => type === 'Legend')
  const label = Option.match(card.maybeSubtitle, {
    onNone: () => card.name,
    onSome: subtitle => `${card.name}, ${subtitle}`,
  })

  return h.keyed('li')(
    card.id,
    [h.Class('flex items-center justify-between gap-3')],
    [
      h.span([h.Class('text-sm')], [label]),
      h.div(
        [h.Class('flex gap-2')],
        [
          Button.view(
            {
              content: [isLegend ? 'Set as legend' : 'Add'],
              variant: 'Secondary',
              onClick: Message.ClickedAddCard({
                cardId: card.id,
                isAdditionalLegend: false,
              }),
            },
            h,
          ),
          ...(isLegend
            ? [
                Button.view(
                  {
                    content: ['Add as additional legend'],
                    variant: 'Secondary',
                    onClick: Message.ClickedAddCard({
                      cardId: card.id,
                      isAdditionalLegend: true,
                    }),
                  },
                  h,
                ),
              ]
            : []),
        ],
      ),
    ],
  )
}

const searchView = (model: Model, h: HtmlBuilder<Message>): Html =>
  h.div(
    [h.Class('flex flex-col gap-2')],
    [
      SearchField.view(
        {
          id: 'deck-add-card',
          label: 'Add a card',
          value: model.searchText,
          placeholder: 'Add a card…',
          onInput: value => Message.UpdatedSearch({ value }),
        },
        h,
      ),
      Array.match(model.searchResults, {
        onEmpty: () => h.empty,
        onNonEmpty: results =>
          h.ul(
            [
              h.AriaLabel('Cards to add'),
              h.Class(
                'flex flex-col gap-2 rounded-card border border-border bg-surface p-3',
              ),
            ],
            Array.map(results, result => resultView(result, h)),
          ),
      }),
    ],
  )

const exportView = (model: Model, h: HtmlBuilder<Message>): Html =>
  Match.value(model.export).pipe(
    Match.withReturnType<Html>(),
    Match.tagsExhaustive({
      Idle: () => h.empty,
      Copied: ({ code }) =>
        h.p(
          [h.Role('status'), h.Class('break-all text-sm text-fg-muted')],
          [`Copied: ${code}`],
        ),
      CopyFailed: ({ code }) =>
        h.p(
          [h.Role('status'), h.Class('break-all text-sm text-fg-muted')],
          [`Copy it by hand: ${code}`],
        ),
      NotEncodable: ({ problem }) =>
        h.p(
          [h.Role('alert'), h.Class('text-sm text-danger')],
          [problemText(problem)],
        ),
    }),
  )

const headerView = (
  model: Model,
  removal: Option.Option<DecksState.Removal>,
  h: HtmlBuilder<Message>,
): Html =>
  h.div(
    [h.Class('flex flex-col gap-4')],
    [
      Link.view({ href: decksRouter(), content: ['← Decks'] }, h),
      TextField.view(
        {
          id: 'deck-name',
          label: 'Deck name',
          field: model.name,
          onInput: value => Message.UpdatedName({ value }),
        },
        h,
      ),
      h.div(
        [h.Class('flex flex-wrap items-center gap-3')],
        [
          Button.view(
            { content: ['Copy deck code'], onClick: Message.ClickedCopyCode() },
            h,
          ),
          ...(model.isConfirmingDelete
            ? [
                smallButton(
                  'Delete for good',
                  Message.ClickedConfirmDelete(),
                  h,
                ),
                smallButton('Keep it', Message.ClickedCancelDelete(), h),
              ]
            : [smallButton('Delete deck', Message.ClickedDelete(), h)]),
        ],
      ),
      exportView(model, h),
      Option.exists(removal, state => state === 'Failed')
        ? h.p(
            [h.Role('alert'), h.Class('text-sm text-danger')],
            ['The deck could not be deleted. Try again.'],
          )
        : h.empty,
    ],
  )

const deckView = (
  model: Model,
  deck: Deck.Deck,
  removal: Option.Option<DecksState.Removal>,
  h: HtmlBuilder<Message>,
): Html => {
  const byPrinting = cardsByPrinting(model.cards)
  const { contents } = deck

  return h.article(
    [h.Class('flex flex-col gap-8')],
    [
      headerView(model, removal, h),
      searchView(model, h),
      h.div(
        [h.Class('grid gap-8 lg:grid-cols-2')],
        [
          h.div(
            [h.Class('flex flex-col gap-6')],
            [
              slotSectionView(
                model,
                'Legend',
                contents.maybeLegend,
                Message.ClickedClearLegend(),
                byPrinting,
                h,
              ),
              slotSectionView(
                model,
                'ChosenChampion',
                contents.maybeChosenChampion,
                Message.ClickedClearChampion(),
                byPrinting,
                h,
              ),
              zoneSectionView(model, 'Main', contents.main, byPrinting, h),
            ],
          ),
          h.div(
            [h.Class('flex flex-col gap-6')],
            [
              zoneSectionView(model, 'Runes', contents.runes, byPrinting, h),
              zoneSectionView(
                model,
                'Battlefields',
                contents.battlefields,
                byPrinting,
                h,
              ),
              zoneSectionView(
                model,
                'Sideboard',
                contents.sideboard,
                byPrinting,
                h,
              ),
              additionalLegendsView(
                model,
                contents.additionalLegends,
                byPrinting,
                h,
              ),
            ],
          ),
        ],
      ),
    ],
  )
}

export const view = Submodel.defineView<Model, Message, ViewInputs>(
  (model, { decks, deckId }, h) =>
    DecksState.Model.match(decks, {
      NotLoaded: () =>
        Notice.view({ title: 'Loading your decks…', description: [] }, h),
      Loading: () =>
        Notice.view({ title: 'Loading your decks…', description: [] }, h),
      Failed: () =>
        Notice.view(
          {
            title: 'Your decks could not be loaded',
            description: ['Check your connection and try again.'],
            variant: 'Error',
            actions: [
              Button.view(
                {
                  content: ['Try again'],
                  onClick: Message.ClickedRetryLoadDecks(),
                },
                h,
              ),
            ],
          },
          h,
        ),
      Ready: ready =>
        Option.match(
          Array.findFirst(ready.decks, deck => deck.id === deckId),
          {
            onNone: () =>
              Notice.view(
                {
                  title: 'Deck not found',
                  description: [
                    'There is no deck at this address. ',
                    Link.view(
                      { href: decksRouter(), content: ['Back to your decks'] },
                      h,
                    ),
                  ],
                },
                h,
              ),
            onSome: deck =>
              deckView(model, deck, Record.get(ready.removals, deck.id), h),
          },
        ),
    }),
)
