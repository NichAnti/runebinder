import { Array } from 'effect'
import type { Html, HtmlBuilder } from 'foldkit/html'

import { Collection } from '../../../../domain'
import { Button, Notice } from '../../../../ui'
import * as CollectionState from '../../collection'

export type SummaryConfig<Message> = Readonly<{
  collection: CollectionState.Model
  printingSets: Collection.PrintingSets
  onRefresh: Message
}>

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

const setsView = <Message>(
  sets: ReadonlyArray<Collection.SetProgress>,
  h: HtmlBuilder<Message>,
): Html =>
  h.ul(
    [h.AriaLabel('Sets'), h.Class('flex flex-wrap gap-x-6 gap-y-2 text-sm')],
    Array.map(sets, ({ set, ownedPrintings, totalPrintings }) =>
      h.keyed('li')(
        set,
        [],
        [
          h.span([h.Class('font-medium')], [set]),
          h.span(
            [h.Class('text-fg-muted tabular-nums')],
            [` ${ownedPrintings} / ${totalPrintings}`],
          ),
        ],
      ),
    ),
  )

const readyView = <Message>(
  ready: typeof CollectionState.Model.Ready.Type,
  { printingSets, onRefresh }: SummaryConfig<Message>,
  h: HtmlBuilder<Message>,
): Html => {
  const summary = Collection.summarize(ready.owned, printingSets)
  const isRefreshing = ready.refresh._tag === 'Refreshing'

  return h.section(
    [h.AriaLabel('Summary'), h.Class('flex flex-col gap-4')],
    [
      h.div(
        [h.Class('flex flex-wrap items-end justify-between gap-4')],
        [
          h.dl(
            [h.Class('flex gap-8')],
            [
              statView('Copies', summary.copies, h),
              statView('Printings', summary.printings, h),
            ],
          ),
          Button.view(
            {
              content: [isRefreshing ? 'Refreshing…' : 'Refresh'],
              variant: 'Secondary',
              onClick: onRefresh,
              isDisabled: isRefreshing,
            },
            h,
          ),
        ],
      ),
      setsView(summary.sets, h),
      ready.refresh._tag === 'Failed'
        ? h.p(
            [h.Role('alert'), h.Class('text-sm text-danger')],
            ['Your collection could not be refreshed. Try again.'],
          )
        : h.empty,
    ],
  )
}

export const summaryView = <Message>(
  config: SummaryConfig<Message>,
  h: HtmlBuilder<Message>,
): Html =>
  CollectionState.Model.match(config.collection, {
    NotLoaded: () =>
      Notice.view({ title: 'Loading your collection…', description: [] }, h),
    Loading: () =>
      Notice.view({ title: 'Loading your collection…', description: [] }, h),
    Failed: () =>
      Notice.view(
        {
          title: 'Your collection could not be loaded',
          description: ['Check your connection and try again.'],
          variant: 'Error',
          actions: [
            Button.view(
              { content: ['Try again'], onClick: config.onRefresh },
              h,
            ),
          ],
        },
        h,
      ),
    Ready: ready => readyView(ready, config, h),
  })
