import { Option } from 'effect'
import { Submodel } from 'foldkit'
import type { Html, HtmlBuilder } from 'foldkit/html'

import { Printing } from '../../../domain'
import { cardRouter } from '../../../route'
import { Button, CardTile, HoverCard, Link } from '../../../ui'
import * as Printings from '../printings'
import { Message } from './message'
import { type Model, PanelCard } from './model'
import { AnchorCardPanel } from './mount'

export type Trigger =
  | Readonly<{ _tag: 'Tile'; tile: CardTile.ViewConfig }>
  | Readonly<{ _tag: 'Line'; content: ReadonlyArray<string> }>

export type ViewInputs = Readonly<{
  cardId: Printing.CardId
  tileId: string
  label: string
  trigger: Trigger
  counts: Printings.Counts
}>

const contentView = (
  panelCard: PanelCard,
  { cardId, label, counts }: ViewInputs,
  h: HtmlBuilder<Message>,
): ReadonlyArray<Html> => [
  h.div(
    [h.Class('mb-3 flex items-start justify-between gap-3')],
    [
      h.h2([h.Class('text-base font-semibold')], [label]),
      Button.view(
        {
          content: ['Close'],
          variant: 'Secondary',
          onClick: Message.ClickedDismiss(),
        },
        h,
      ),
    ],
  ),
  PanelCard.match(panelCard, {
    Loading: () =>
      h.p(
        [h.Role('status'), h.Class('text-sm text-fg-muted')],
        ['Loading printings…'],
      ),
    Missing: () =>
      h.p(
        [h.Class('text-sm text-fg-muted')],
        ['This card is not in the catalogue.'],
      ),
    Found: ({ card }) =>
      h.div(
        [h.Class('flex flex-col gap-3')],
        [
          Printings.printingsView(
            {
              card,
              counts,
              selected: Printing.basePrinting(card).id,
              hrefFor: ({ id }) =>
                cardRouter({ cardId, printing: Option.some(id) }),
              onStep: (printingId, step) =>
                Message.ClickedStepQuantity({ printingId, step }),
              onRetry: Message.ClickedRetryCollection(),
              isShowingImages: false,
            },
            h,
          ),
          Link.view(
            {
              href: cardRouter({ cardId, printing: Option.none() }),
              content: ['Open card page'],
            },
            h,
          ),
        ],
      ),
  }),
]

export const tileView = Submodel.defineView<Model, Message, ViewInputs>(
  (model, viewInputs, h) => {
    const id = `card-panel-${viewInputs.tileId}`
    const maybeOpen =
      model.panel._tag === 'Open' && model.panel.tileId === viewInputs.tileId
        ? Option.some(model.panel)
        : Option.none()
    const isPinned = Option.exists(
      maybeOpen,
      ({ opener }) => opener === 'Click',
    )

    return HoverCard.view(
      {
        id,
        label: viewInputs.label,
        hoverIntent: model.hoverIntent,
        toHoverIntentMessage: message =>
          Message.GotHoverIntentMessage({
            cardId: viewInputs.cardId,
            tileId: viewInputs.tileId,
            message,
          }),
        trigger:
          viewInputs.trigger._tag === 'Tile'
            ? [CardTile.view(viewInputs.trigger.tile, h)]
            : viewInputs.trigger.content,
        onClick: Message.ClickedTrigger({
          cardId: viewInputs.cardId,
          tileId: viewInputs.tileId,
        }),
        isOpen: Option.isSome(maybeOpen),
        isPinned,
        onDismiss: Message.ClickedDismiss(),
        anchorPanel: AnchorCardPanel({
          buttonId: HoverCard.triggerId(id),
          isFocused: isPinned,
        }),
        panel: Option.match(maybeOpen, {
          onNone: () => [],
          onSome: ({ card }) => contentView(card, viewInputs, h),
        }),
      },
      h,
    )
  },
)
