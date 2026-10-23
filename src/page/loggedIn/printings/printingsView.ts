import { Array, Number, Option, Record } from 'effect'
import type { Html, HtmlBuilder } from 'foldkit/html'

import { type DeckEdit, Printing, Wishlist } from '../../../domain'
import { Button, IconButton, Link, QuantityStepper } from '../../../ui'
import { type CountKind, Counts } from './counts'

export const VARIANT_LABELS: Readonly<Record<Printing.Variant, string>> = {
  Base: 'Standard',
  AlternateArt: 'Alternate art',
  Signature: 'Signature',
  Overnumbered: 'Overnumbered',
}

const STEPPER_LABELS: Readonly<Record<CountKind, string>> = {
  Owned: 'Owned',
  InDeck: 'In deck',
}

export type PrintingsConfig<Message> = Readonly<{
  card: Printing.Card
  counts: Counts
  selected: Printing.PrintingId
  hrefFor: (printing: Printing.Printing) => string
  onStep: (printingId: Printing.PrintingId, step: DeckEdit.Step) => Message
  onRetry: Message
  isShowingImages: boolean
  isLinkingCardTrader?: boolean
}>

const labelOf = (printing: Printing.Printing): string =>
  `${VARIANT_LABELS[printing.variant]} · ${printing.publicCode} · ${printing.rarity}`

const quantityIn = (
  quantities: Readonly<Record<string, number>>,
  printingId: Printing.PrintingId,
): number => Option.getOrElse(Record.get(quantities, printingId), () => 0)

const stepperView = <Message>(
  printing: Printing.Printing,
  { counts, onStep }: PrintingsConfig<Message>,
  h: HtmlBuilder<Message>,
): Html =>
  counts._tag === 'Ready'
    ? QuantityStepper.view(
        {
          label: `${STEPPER_LABELS[counts.kind]}: ${VARIANT_LABELS[printing.variant]} ${printing.publicCode}`,
          quantity: quantityIn(counts.quantities, printing.id),
          max: counts.max,
          onDecrement: onStep(printing.id, -1),
          onIncrement: onStep(printing.id, 1),
        },
        h,
      )
    : h.empty

const totalText = (kind: CountKind, total: number): string => {
  if (kind === 'InDeck') {
    return total === 1
      ? '1 copy in this deck.'
      : `${total} copies in this deck.`
  } else if (total === 0) {
    return 'You own none yet.'
  } else {
    return `You own ${total}.`
  }
}

const summaryView = <Message>(
  { card, counts, onRetry }: PrintingsConfig<Message>,
  h: HtmlBuilder<Message>,
): Html =>
  Counts.match(counts, {
    Loading: () =>
      h.p(
        [h.Role('status'), h.Class('text-sm text-fg-muted')],
        ['Loading your collection…'],
      ),
    Failed: () =>
      h.div(
        [
          h.Role('alert'),
          h.Class('flex items-center gap-3 text-sm text-danger'),
        ],
        [
          'Your collection could not be loaded.',
          Button.view(
            { content: ['Try again'], variant: 'Secondary', onClick: onRetry },
            h,
          ),
        ],
      ),
    Ready: ({ kind, quantities }) =>
      h.p(
        [h.Class('text-sm text-fg-muted')],
        [
          totalText(
            kind,
            Number.sumAll(
              Array.map(card.printings, ({ id }) => quantityIn(quantities, id)),
            ),
          ),
        ],
      ),
  })

const linkView = <Message>(
  printing: Printing.Printing,
  config: PrintingsConfig<Message>,
  h: HtmlBuilder<Message>,
): Html =>
  Link.view(
    config.isShowingImages
      ? {
          href: config.hrefFor(printing),
          content: [
            h.img([
              h.Src(printing.imageUrl),
              h.Alt(''),
              h.Loading('lazy'),
              h.Class(
                `w-14 rounded-control bg-surface-raised ${printing.orientation === 'Landscape' ? 'aspect-[1039/744]' : 'aspect-[744/1039]'}`,
              ),
            ]),
            labelOf(printing),
          ],
          variant: 'Media',
          isCurrent: printing.id === config.selected,
        }
      : {
          href: config.hrefFor(printing),
          content: [labelOf(printing)],
          variant: 'Nav',
          isCurrent: printing.id === config.selected,
        },
    h,
  )

const cardTraderLinkView = <Message>(
  printing: Printing.Printing,
  { isLinkingCardTrader = false }: PrintingsConfig<Message>,
  h: HtmlBuilder<Message>,
): Html =>
  Option.match(
    Option.filter(printing.maybeCardTrader, () => isLinkingCardTrader),
    {
      onNone: () => h.empty,
      onSome: blueprint =>
        IconButton.view(
          {
            icon: 'ArrowTopRightOnSquare',
            label: `Open ${VARIANT_LABELS[printing.variant]} ${printing.publicCode} on CardTrader`,
            action: {
              _tag: 'External',
              href: Wishlist.cardTraderCardUrl(blueprint.id),
            },
          },
          h,
        ),
    },
  )

export const printingsView = <Message>(
  config: PrintingsConfig<Message>,
  h: HtmlBuilder<Message>,
): Html =>
  h.section(
    [h.AriaLabel('Printings'), h.Class('flex flex-col gap-3')],
    [
      h.h2([h.Class('text-sm font-medium')], ['Printings']),
      summaryView(config, h),
      h.ul(
        [h.Class('flex flex-col gap-2')],
        Array.map(config.card.printings, printing =>
          h.keyed('li')(
            printing.id,
            [h.Class('flex items-center justify-between gap-3')],
            [
              linkView(printing, config, h),
              h.div(
                [h.Class('flex items-center gap-2')],
                [
                  cardTraderLinkView(printing, config, h),
                  stepperView(printing, config, h),
                ],
              ),
            ],
          ),
        ),
      ),
    ],
  )
