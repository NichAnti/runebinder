import { Array, Match, Option } from 'effect'
import type { Html, HtmlBuilder } from 'foldkit/html'

import { Deck, DeckRules, Printing } from '../../../../domain'
import { decksRouter } from '../../../../route'
import {
  Badge,
  IconButton,
  Link,
  ProgressChip,
  SegmentedControl,
  TextField,
} from '../../../../ui'
import { problemText } from '../deckList/problemText'
import { type Context, problemsIn } from './context'
import { Message } from './message'
import { type Layout, type Model } from './model'
import { removalFailedView } from './view'
import { identitySlotView, problemsView } from './zoneView'

// HEADER

type Part = Readonly<{
  section: DeckRules.Section
  label: string
  value: string
}>

const slotValue = (maybePrintingId: Option.Option<Printing.PrintingId>) =>
  Option.isSome(maybePrintingId) ? 'chosen' : 'to choose'

const partsOf = (context: Context): ReadonlyArray<Part> => {
  const { contents } = context.deck
  const additional: ReadonlyArray<Part> =
    context.additionalLegendsAsked > 0
      ? [
          {
            section: 'AdditionalLegends',
            label: 'Additional legends',
            value: `${Array.length(contents.additionalLegends)}/${context.additionalLegendsAsked}`,
          },
        ]
      : []

  return [
    {
      section: 'Legend',
      label: 'Legend',
      value: slotValue(contents.maybeLegend),
    },
    {
      section: 'ChosenChampion',
      label: 'Champion',
      value: slotValue(contents.maybeChosenChampion),
    },
    {
      section: 'Main',
      label: 'Main',
      value: `${Deck.mainDeckSize(contents)}/${DeckRules.CONSTRUCTED_MAIN_DECK_SIZE}`,
    },
    {
      section: 'Runes',
      label: 'Runes',
      value: `${Deck.copiesIn(contents.runes)}/${DeckRules.RUNE_DECK_SIZE}`,
    },
    {
      section: 'Battlefields',
      label: 'Battlefields',
      value: `${Deck.copiesIn(contents.battlefields)}/${DeckRules.CONSTRUCTED_BATTLEFIELDS}`,
    },
    {
      section: 'Sideboard',
      label: 'Sideboard',
      value: `${Deck.copiesIn(contents.sideboard)}/${DeckRules.MAX_SIDEBOARD}`,
    },
    ...additional,
  ]
}

const statusOf = (
  context: Context,
  section: DeckRules.Section,
): ProgressChip.Status =>
  Option.match(context.problems, {
    onNone: () => 'Unfinished',
    onSome: () => DeckRules.progressOf(problemsIn(context, section)),
  })

const rulesText = (context: Context): string =>
  Option.match(context.problems, {
    onNone: () => 'Checking the rules…',
    onSome: problems =>
      Array.match(problems, {
        onEmpty: () => 'Follows the official deckbuilding rules',
        onNonEmpty: nonEmpty =>
          Array.every(nonEmpty, DeckRules.isUnfinished)
            ? 'Not finished yet'
            : 'Breaks a deckbuilding rule: see the marked parts',
      }),
  })

export const progressView = (context: Context, h: HtmlBuilder<Message>): Html =>
  h.nav(
    [
      h.AriaLabel('Deck progress'),
      h.Class(
        'sticky top-0 z-10 -mx-4 flex items-center gap-2 overflow-x-auto border-b border-border bg-canvas px-4 py-2 lg:flex-wrap',
      ),
    ],
    [
      ...Array.map(partsOf(context), ({ section, label, value }) =>
        ProgressChip.view(
          {
            label,
            value,
            status: statusOf(context, section),
            onClick: Message.ClickedProgress({ section }),
          },
          h,
        ),
      ),
      h.p(
        [
          h.Role('status'),
          h.Class('ml-auto shrink-0 whitespace-nowrap text-sm text-fg-muted'),
        ],
        [rulesText(context)],
      ),
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

export const headerView = (context: Context, h: HtmlBuilder<Message>): Html => {
  const { contents } = context.deck

  return h.header(
    [h.Class('flex flex-col gap-4')],
    [
      Link.view({ href: decksRouter(), content: ['← Decks'] }, h),
      h.div(
        [h.Class('flex flex-wrap items-start gap-4')],
        [
          identitySlotView(
            context,
            'Legend',
            contents.maybeLegend,
            'Legend',
            Message.ClickedClearLegend(),
            h,
          ),
          identitySlotView(
            context,
            'ChosenChampion',
            contents.maybeChosenChampion,
            'Champion',
            Message.ClickedClearChampion(),
            h,
          ),
          h.div(
            [h.Class('flex min-w-64 flex-1 flex-col gap-3')],
            [
              h.div(
                [h.Class('flex items-start justify-between gap-3')],
                [
                  h.div(
                    [h.Class('min-w-0 flex-1')],
                    [
                      TextField.view(
                        {
                          id: 'deck-name',
                          label: 'Deck name',
                          field: context.model.name,
                          onInput: value => Message.UpdatedName({ value }),
                          variant: 'Title',
                        },
                        h,
                      ),
                    ],
                  ),
                  h.div(
                    [h.Class('flex shrink-0 items-center gap-2')],
                    [
                      SegmentedControl.view(
                        {
                          label: 'Show cards as',
                          choices: [
                            { value: 'Grid', label: 'Grid' },
                            { value: 'List', label: 'List' },
                          ] satisfies ReadonlyArray<
                            SegmentedControl.Choice<Layout>
                          >,
                          selected: context.model.layout,
                          onSelect: layout =>
                            Message.SelectedLayout({ layout }),
                        },
                        h,
                      ),
                      IconButton.view(
                        {
                          icon: 'ClipboardDocument',
                          label: 'Copy deck code',
                          action: {
                            _tag: 'Click',
                            message: Message.ClickedCopyCode(),
                          },
                        },
                        h,
                      ),
                      IconButton.view(
                        {
                          icon: 'DocumentDuplicate',
                          label: 'Duplicate deck',
                          action: {
                            _tag: 'Click',
                            message: Message.ClickedDuplicate(),
                          },
                        },
                        h,
                      ),
                      IconButton.view(
                        {
                          icon: 'Trash',
                          label: 'Delete deck',
                          variant: 'Danger',
                          isDisabled: Option.exists(
                            context.removal,
                            state => state === 'Removing',
                          ),
                          action: {
                            _tag: 'Click',
                            message: Message.ClickedDelete(),
                          },
                        },
                        h,
                      ),
                    ],
                  ),
                ],
              ),
              Option.match(context.maybeLegend, {
                onNone: () =>
                  h.p(
                    [h.Class('text-sm text-fg-muted')],
                    ['Choose a legend to set the deck’s domains.'],
                  ),
                onSome: legend =>
                  h.div(
                    [h.AriaLabel('Domains'), h.Class('flex flex-wrap gap-1.5')],
                    Array.map(legend.domains, domain =>
                      Badge.view({ content: [domain], tone: domain }, h),
                    ),
                  ),
              }),
              problemsView(context, ['Legend', 'ChosenChampion'], h),
              exportView(context.model, h),
              removalFailedView(context.removal, h),
            ],
          ),
        ],
      ),
    ],
  )
}
