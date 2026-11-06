import type { Html, HtmlBuilder } from 'foldkit/html'

import type { Wishlist } from '../../../../domain'
import { wishlistsRouter } from '../../../../route'
import { Link } from '../../../../ui'

const statView = <Message>(
  label: string,
  value: number,
  h: HtmlBuilder<Message>,
): Html =>
  h.div(
    [h.Class('flex flex-col')],
    [
      h.dt([h.Class('text-xs text-fg-muted')], [label]),
      h.dd([h.Class('text-2xl font-semibold tabular-nums')], [`${value}`]),
    ],
  )

export const wantedSummaryView = <Message>(
  wanted: Wishlist.Wanted,
  h: HtmlBuilder<Message>,
): Html =>
  h.section(
    [
      h.AriaLabel('Wanted summary'),
      h.Class(
        'flex flex-wrap items-end justify-between gap-4 rounded-card border border-border bg-surface p-4',
      ),
    ],
    [
      h.dl(
        [h.Class('flex gap-8')],
        [
          statView('Copies wanted', wanted.fromDecks + wanted.fromCustom, h),
          statView('Missing from decks', wanted.fromDecks, h),
          statView('Custom wishlist', wanted.fromCustom, h),
        ],
      ),
      Link.view({ href: wishlistsRouter(), content: ['Open wishlists'] }, h),
    ],
  )
