import { Array, Option, Record, String } from 'effect'
import type { Html, HtmlBuilder } from 'foldkit/html'

import { Deck, DeckRules, Printing } from '../../../../domain'
import { Badge, IconButton, QuantityStepper, Select } from '../../../../ui'
import { type Context, SECTION_LABELS, badgesFor, tileOf } from './context'
import { copiesIn, copyStepOf } from './copies'
import { type Line, isChampionUnit } from './lines'
import { Message } from './message'
import { panelView } from './view'

const ZONE_SHORT_LABELS: Readonly<Record<Deck.Zone, string>> = {
  Main: 'Main',
  Sideboard: 'Side',
  Runes: 'Runes',
  Battlefields: 'Fields',
}

export const countersView = (
  context: Context,
  cardId: Printing.CardId,
  printingIds: ReadonlyArray<Printing.PrintingId>,
  maybeLimit: Option.Option<number>,
  maybeVersion: Option.Option<Printing.PrintingId>,
  zone: Deck.Zone,
  label: string,
  h: HtmlBuilder<Message>,
): Html => {
  const { contents } = context.deck
  const zones: ReadonlyArray<Deck.Zone> =
    zone === 'Main' || zone === 'Sideboard' ? ['Main', 'Sideboard'] : [zone]
  const counted = Option.match(maybeVersion, {
    onNone: () => printingIds,
    onSome: version => [version],
  })
  const counter = (countedZone: Deck.Zone) => {
    const copies = copiesIn(contents, countedZone, counted)
    const canAdd = Option.isSome(
      copyStepOf(
        contents,
        countedZone,
        printingIds,
        maybeLimit,
        1,
        maybeVersion,
      ),
    )

    return h.div(
      [h.Class('flex w-full items-center justify-between gap-2')],
      [
        h.span(
          [h.AriaHidden(true), h.Class('text-xs text-fg-muted')],
          [ZONE_SHORT_LABELS[countedZone]],
        ),
        QuantityStepper.view(
          {
            size: 'Small',
            label: `In ${SECTION_LABELS[countedZone]}: ${label}`,
            quantity: copies,
            max: canAdd ? copies + 1 : copies,
            onDecrement: Message.ClickedStepCopies({
              cardId,
              maybeVersion,
              zone: countedZone,
              step: -1,
            }),
            onIncrement: Message.ClickedStepCopies({
              cardId,
              maybeVersion,
              zone: countedZone,
              step: 1,
            }),
          },
          h,
        ),
      ],
    )
  }

  return h.div(
    [h.Class('flex w-full flex-col gap-1')],
    Array.map(zones, counter),
  )
}

const lineStepper = (
  context: Context,
  zone: Deck.Zone,
  line: Line,
  h: HtmlBuilder<Message>,
): Html =>
  Option.match(line.maybeCard, {
    onNone: () => {
      const primary = Array.reduce(
        line.cards,
        Array.headNonEmpty(line.cards),
        (most, card) => (card.copies > most.copies ? card : most),
      )

      return QuantityStepper.view(
        {
          label: `Copies: ${line.label}`,
          quantity: line.copies,
          max: Deck.MAX_COPIES,
          onDecrement: Message.ClickedStepLine({
            zone,
            printingId: primary.printingId,
            step: -1,
          }),
          onIncrement: Message.ClickedStepLine({
            zone,
            printingId: primary.printingId,
            step: 1,
          }),
        },
        h,
      )
    },
    onSome: card =>
      countersView(
        context,
        card.id,
        Array.map(card.printings, ({ id }) => id),
        DeckRules.copyLimitOf(Printing.basePrinting(card)),
        Option.some(Array.headNonEmpty(line.cards).printingId),
        zone,
        line.label,
        h,
      ),
  })

const SHORT_VARIANT_LABELS: Readonly<Record<Printing.Variant, string>> = {
  Base: 'Standard',
  AlternateArt: 'Alt art',
  Signature: 'Signed',
  Overnumbered: 'Overnumbered',
}

const shortVersionLabel = (printing: Printing.Printing): string =>
  `${SHORT_VARIANT_LABELS[printing.variant]} · ${String.replace(/\/\d+$/, '')(printing.publicCode)}`

export const versionPickerView = (
  card: Printing.Card,
  printingId: Printing.PrintingId,
  id: string,
  onChange: (value: string) => Message,
  h: HtmlBuilder<Message>,
): Html =>
  Array.length(card.printings) > 1
    ? Select.view(
        {
          id,
          label: 'Version',
          value: printingId,
          options: Array.map(card.printings, printing => ({
            value: printing.id,
            label: shortVersionLabel(printing),
          })),
          onChange,
          variant: 'Compact',
        },
        h,
      )
    : h.empty

const lineVersionView = (
  zone: Deck.Zone,
  line: Line,
  h: HtmlBuilder<Message>,
): Html =>
  Option.match(line.maybeCard, {
    onNone: () => h.empty,
    onSome: card => {
      const from = Array.headNonEmpty(line.cards).printingId

      return versionPickerView(
        card,
        from,
        `version-${zone}-${from}`,
        value => Message.SelectedVersion({ zone, from, value }),
        h,
      )
    },
  })

const championButton = (
  zone: Deck.Zone,
  line: Line,
  h: HtmlBuilder<Message>,
): Html =>
  zone === 'Main' && Option.exists(line.maybeCard, isChampionUnit)
    ? IconButton.view(
        {
          icon: 'Star',
          label: `Make ${line.label} the chosen champion`,
          size: 'Small',
          action: {
            _tag: 'Click',
            message: Message.ClickedMakeChampion({
              printingId: Array.headNonEmpty(line.cards).printingId,
            }),
          },
        },
        h,
      )
    : h.empty

export const versionCaption = (
  card: Printing.Card,
  printingId: Printing.PrintingId,
  h: HtmlBuilder<Message>,
): Html =>
  h.span(
    [h.Class('min-w-0 flex-1 truncate text-xs text-fg-muted')],
    [
      Option.match(
        Array.findFirst(card.printings, ({ id }) => id === printingId),
        { onNone: () => '', onSome: shortVersionLabel },
      ),
    ],
  )

const versionRow = (
  zone: Deck.Zone,
  line: Line,
  h: HtmlBuilder<Message>,
): Html =>
  h.div(
    [h.Class('flex h-7 items-center gap-1')],
    [
      Option.match(line.maybeCard, {
        onNone: () => h.empty,
        onSome: card => {
          const from = Array.headNonEmpty(line.cards).printingId

          return Array.length(card.printings) > 1
            ? h.div(
                [h.Class('min-w-0 flex-1')],
                [lineVersionView(zone, line, h)],
              )
            : versionCaption(card, from, h)
        },
      }),
      championButton(zone, line, h),
    ],
  )

export const gridLineView = (
  context: Context,
  zone: Deck.Zone,
  line: Line,
  h: HtmlBuilder<Message>,
): Html =>
  h.keyed('li')(
    line.key,
    [h.Class('flex min-w-0 flex-col gap-2')],
    [
      Option.match(line.maybeCard, {
        onNone: () => h.span([h.Class('text-sm')], [line.label]),
        onSome: card =>
          panelView(
            context,
            zone,
            line.key,
            card,
            {
              _tag: 'Tile',
              tile: tileOf(
                card,
                Array.headNonEmpty(line.cards).printingId,
                badgesFor(
                  context,
                  Array.map(line.cards, ({ printingId }) => printingId),
                ),
              ),
            },
            h,
          ),
      }),
      h.div(
        [h.Class('mt-auto flex flex-col gap-2')],
        [versionRow(zone, line, h), lineStepper(context, zone, line, h)],
      ),
    ],
  )

export const listLineView = (
  context: Context,
  zone: Deck.Zone,
  line: Line,
  h: HtmlBuilder<Message>,
): Html =>
  h.keyed('li')(
    line.key,
    [h.Class('flex flex-wrap items-center justify-between gap-2')],
    [
      h.div(
        [h.Class('flex min-w-0 flex-1 items-center gap-2')],
        [
          Option.match(line.maybeCard, {
            onNone: () => h.span([h.Class('text-sm')], [line.label]),
            onSome: card =>
              panelView(
                context,
                zone,
                line.key,
                card,
                {
                  _tag: 'Line',
                  content: [line.label],
                },
                h,
              ),
          }),
          ...Array.map(
            badgesFor(
              context,
              Array.map(line.cards, ({ printingId }) => printingId),
            ),
            text => Badge.view({ content: [text], tone: 'Accent' }, h),
          ),
        ],
      ),
      lineVersionView(zone, line, h),
      lineStepper(context, zone, line, h),
      championButton(zone, line, h),
    ],
  )
