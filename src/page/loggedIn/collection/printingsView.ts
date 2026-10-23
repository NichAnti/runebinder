import { Array } from 'effect'
import type { Html, HtmlBuilder } from 'foldkit/html'

import { Collection, Printing } from '../../../domain'
import { Button, Link, QuantityStepper } from '../../../ui'
import { Model as CollectionModel } from './model'
import type { Step } from './update'

export const VARIANT_LABELS: Readonly<Record<Printing.Variant, string>> = {
  Base: 'Standard',
  AlternateArt: 'Alternate art',
  Signature: 'Signature',
  Overnumbered: 'Overnumbered',
}

export type PrintingsConfig<Message> = Readonly<{
  card: Printing.Card
  collection: CollectionModel
  selected: Printing.PrintingId
  hrefFor: (printing: Printing.Printing) => string
  onStep: (printingId: Printing.PrintingId, step: Step) => Message
  onRetry: Message
  isShowingImages: boolean
}>

const labelOf = (printing: Printing.Printing): string =>
  `${VARIANT_LABELS[printing.variant]} · ${printing.publicCode} · ${printing.rarity}`

const ownedView = <Message>(
  printing: Printing.Printing,
  { collection, onStep }: PrintingsConfig<Message>,
  h: HtmlBuilder<Message>,
): Html =>
  collection._tag === 'Ready'
    ? QuantityStepper.view(
        {
          label: `Owned: ${VARIANT_LABELS[printing.variant]} ${printing.publicCode}`,
          quantity: Collection.quantityOf(collection.owned, printing.id),
          max: Collection.MAX_QUANTITY,
          onDecrement: onStep(printing.id, -1),
          onIncrement: onStep(printing.id, 1),
        },
        h,
      )
    : h.empty

const loadingView = <Message>(h: HtmlBuilder<Message>): Html =>
  h.p(
    [h.Role('status'), h.Class('text-sm text-fg-muted')],
    ['Loading your collection…'],
  )

const summaryView = <Message>(
  { card, collection, onRetry }: PrintingsConfig<Message>,
  h: HtmlBuilder<Message>,
): Html =>
  CollectionModel.match(collection, {
    NotLoaded: () => loadingView(h),
    Loading: () => loadingView(h),
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
    Ready: ({ owned }) => {
      const total = Collection.totalOf(
        owned,
        Array.map(card.printings, ({ id }) => id),
      )
      return h.p(
        [h.Class('text-sm text-fg-muted')],
        [total === 0 ? 'You own none yet.' : `You own ${total}.`],
      )
    },
  })

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
              ),
              ownedView(printing, config, h),
            ],
          ),
        ),
      ),
    ],
  )
