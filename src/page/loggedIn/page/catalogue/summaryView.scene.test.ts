import type { Update } from 'foldkit'
import type { HtmlBuilder } from 'foldkit/html'
import { defineMessageUnion } from 'foldkit/message'
import { click, expect, given, role, scene, text, within } from 'foldkit/scene'
import { modifyFields } from 'foldkit/struct'
import { describe, test } from 'vitest'

import { Collection, Printing } from '../../../../domain'
import * as CollectionState from '../../collection'
import { summaryView } from './summaryView'

const Message = defineMessageUnion({ ClickedRetry: {} })
type Message = typeof Message.Type

type Model = Readonly<{
  collection: CollectionState.Model
  retryCount: number
}>

const vi = Printing.PrintingId.make('ogn-066-298')
const printingSets = {
  [vi]: Printing.SetCode.make('OGN'),
  [Printing.PrintingId.make('ogn-066a-298')]: Printing.SetCode.make('OGN'),
}

const ready: Model = {
  collection: CollectionState.Model.Ready({
    owned: { [vi]: Collection.OwnedQuantity.make(3) },
    saves: {},
    nextRevision: 0,
  }),
  retryCount: 0,
}

const update = (model: Model, message: Message) =>
  Message.match<Update.Return<Model, Message>>(message, {
    ClickedRetry: () => ({
      model: modifyFields(model, { retryCount: count => count + 1 }),
    }),
  })

const view = (model: Model, h: HtmlBuilder<Message>) =>
  h.div(
    [],
    [
      summaryView(
        {
          collection: model.collection,
          printingSets,
          onRetry: Message.ClickedRetry(),
        },
        h,
      ),
      h.p([], [`Retries: ${model.retryCount}`]),
    ],
  )

describe('collection summary', () => {
  test('shows copies, printings and each set’s progress', () => {
    scene(
      { update, view },
      given(ready),
      expect(text('Copies')).toExist(),
      expect(
        within(role('list', { name: 'Sets' }), role('listitem')),
      ).toHaveText('OGN 1 / 2'),
      expect(role('button', { name: 'Refresh' })).not.toExist(),
    )
  })

  test('a collection that failed to load offers to try again', () => {
    scene(
      { update, view },
      given(
        modifyFields(ready, {
          collection: () => CollectionState.Model.Failed(),
        }),
      ),
      expect(role('alert')).toContainText('could not be loaded'),
      click(role('button', { name: 'Try again' })),
      expect(text('Retries: 1')).toExist(),
    )
  })
})
