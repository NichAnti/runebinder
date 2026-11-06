import { Array } from 'effect'
import type { Html, HtmlBuilder } from 'foldkit/html'

import { wishlistHref } from '../../../../route'
import { Link } from '../../../../ui'
import {
  type CardTraderInputs,
  actionsView,
  failureView,
  onCardTraderView,
  statusView,
} from './cardTraderView'
import { copiesText } from './detailView'
import type { Message } from './message'
import type { Model } from './model'
import type { Section } from './sections'

const rowView = (
  model: Model,
  section: Section,
  inputs: CardTraderInputs,
  h: HtmlBuilder<Message>,
): Html =>
  h.keyed('li')(
    section.key,
    [
      h.Class(
        'flex flex-col gap-2 rounded-card border border-border bg-surface p-4',
      ),
    ],
    [
      h.div(
        [h.Class('flex flex-wrap items-center justify-between gap-3')],
        [
          h.div(
            [h.Class('flex min-w-48 flex-1 flex-col gap-0.5')],
            [
              h.span(
                [h.Class('flex flex-wrap items-baseline gap-2')],
                [
                  Link.view(
                    {
                      href: wishlistHref(section.wishlist),
                      content: [section.title],
                    },
                    h,
                  ),
                  h.span(
                    [h.Class('text-sm tabular-nums text-fg-muted')],
                    [copiesText(section)],
                  ),
                ],
              ),
              statusView(section, inputs, h),
            ],
          ),
          actionsView(model, section, inputs, h),
        ],
      ),
      failureView(section, inputs, h),
    ],
  )

export const listView = (
  model: Model,
  sections: ReadonlyArray<Section>,
  inputs: CardTraderInputs,
  h: HtmlBuilder<Message>,
): Html =>
  h.div(
    [h.Class('flex flex-col gap-10')],
    [
      h.section(
        [h.AriaLabel('Your wishlists'), h.Class('flex flex-col gap-3')],
        [
          h.h1([h.Class('text-2xl font-semibold')], ['Wishlists']),
          h.p(
            [h.Class('text-sm text-fg-muted')],
            [
              'One wishlist per deck with the cards you are missing, and a custom one you fill by hand.',
            ],
          ),
          h.ul(
            [h.AriaLabel('Wishlists'), h.Class('flex flex-col gap-2')],
            Array.map(sections, section => rowView(model, section, inputs, h)),
          ),
        ],
      ),
      onCardTraderView(sections, inputs, h),
    ],
  )
