import { Effect, Option } from 'effect'
import { Command, Update } from 'foldkit'
import { modifyFields } from 'foldkit/struct'

import { HoverIntent } from '@foldkit/ui'

import { Printing } from '../../../domain'
import {
  CatalogueIndex,
  CatalogueIndexResource,
  type CatalogueIndexService,
} from '../../../service'
import { Message, OutMessage } from './message'
import { type Model, type Opener, Panel, PanelCard, type Target } from './model'

type UpdateReturn = Update.ReturnWithOutMessage<
  Model,
  Message,
  OutMessage,
  CatalogueIndexService
>
type Step = Update.Step<Model, Message, CatalogueIndexService>

// COMMAND

export const LoadPanelCard = Command.define('LoadPanelCard', {
  args: { cardId: Printing.CardId },
  messages: [Message.SucceededLoadPanelCard, Message.SkippedLoadPanelCard],
  execute: ({ cardId }) =>
    Effect.gen(function* () {
      const index = yield* CatalogueIndexResource.get
      return Message.SucceededLoadPanelCard({
        cardId,
        maybeCard: CatalogueIndex.cardById(index, cardId),
      })
    }).pipe(
      Effect.catchTag('ResourceNotAvailable', () =>
        Effect.succeed(Message.SkippedLoadPanelCard()),
      ),
    ),
})

// UPDATE

const isOpenFor = (model: Model, tileId: string): boolean =>
  model.panel._tag === 'Open' && model.panel.tileId === tileId

const isPinned = (model: Model): boolean =>
  model.panel._tag === 'Open' && model.panel.opener === 'Click'

const open =
  ({ cardId, tileId }: Target, opener: Opener): Step =>
  stepModel =>
    Panel.match(stepModel.panel, {
      Open: panel =>
        panel.cardId === cardId
          ? {
              model: modifyFields(stepModel, {
                panel: () =>
                  modifyFields(panel, {
                    tileId: () => tileId,
                    opener: () => opener,
                  }),
              }),
            }
          : {
              model: modifyFields(stepModel, {
                panel: () =>
                  Panel.Open({
                    cardId,
                    tileId,
                    opener,
                    card: PanelCard.Loading(),
                  }),
              }),
              commands: [LoadPanelCard({ cardId })],
            },
      Closed: () => ({
        model: modifyFields(stepModel, {
          panel: () =>
            Panel.Open({
              cardId,
              tileId,
              opener,
              card: PanelCard.Loading(),
            }),
        }),
        commands: [LoadPanelCard({ cardId })],
      }),
    })

const closeUnlessPinned: Step = stepModel =>
  isPinned(stepModel)
    ? { model: stepModel }
    : { model: modifyFields(stepModel, { panel: () => Panel.Closed() }) }

const foldHoverIntentOutMessage = (target: Target) =>
  HoverIntent.OutMessage.match<Step>({
    Opened: () => stepModel =>
      isPinned(stepModel)
        ? { model: stepModel }
        : open(target, 'Hover')(stepModel),
    Closed: () => closeUnlessPinned,
  })

const readHoverIntent = (model: Model) => Option.some(model.hoverIntent)
const writeHoverIntent = (
  model: Model,
  nextHoverIntent: HoverIntent.Model,
): Model => modifyFields(model, { hoverIntent: () => nextHoverIntent })

const foldHoverIntent = (target: Target) =>
  Update.foldChild({
    update: HoverIntent.update,
    read: readHoverIntent,
    write: writeHoverIntent,
    toParentMessage: message =>
      Message.GotHoverIntentMessage({ ...target, message }),
    foldOutMessage: foldHoverIntentOutMessage(target),
  })

const foldHoverIntentClose = (target: Target) =>
  Update.foldChildStep({
    update: HoverIntent.close,
    read: readHoverIntent,
    write: writeHoverIntent,
    toParentMessage: message =>
      Message.GotHoverIntentMessage({ ...target, message }),
    foldOutMessage: foldHoverIntentOutMessage(target),
  })

const isEntering = (message: HoverIntent.Message): boolean =>
  message._tag === 'EnteredTrigger' || message._tag === 'FocusedTrigger'

const followHover =
  (target: Target, message: HoverIntent.Message): Step =>
  stepModel =>
    isEntering(message) &&
    stepModel.panel._tag === 'Open' &&
    stepModel.panel.opener === 'Hover' &&
    stepModel.panel.tileId !== target.tileId
      ? open(target, 'Hover')(stepModel)
      : { model: stepModel }

export const update = (model: Model, message: Message) =>
  Message.match<UpdateReturn>(message, {
    GotHoverIntentMessage: ({ cardId, tileId, message }) =>
      Update.combine(model, [
        foldHoverIntent({ cardId, tileId })(message),
        followHover({ cardId, tileId }, message),
      ]),

    ClickedTrigger: ({ cardId, tileId }) =>
      isOpenFor(model, tileId) && isPinned(model)
        ? Update.combine(model, [
            stepModel => ({
              model: modifyFields(stepModel, { panel: () => Panel.Closed() }),
            }),
            foldHoverIntentClose({ cardId, tileId }),
          ])
        : Update.combine(model, [
            open({ cardId, tileId }, 'Click'),
            foldHoverIntentClose({ cardId, tileId }),
          ]),

    ClickedDismiss: () =>
      Panel.match<UpdateReturn>(model.panel, {
        Closed: () => ({ model }),
        Open: ({ cardId, tileId }) =>
          Update.combine(model, [
            stepModel => ({
              model: modifyFields(stepModel, { panel: () => Panel.Closed() }),
            }),
            foldHoverIntentClose({ cardId, tileId }),
          ]),
      }),

    SucceededLoadPanelCard: ({ cardId, maybeCard }) =>
      Panel.match<UpdateReturn>(model.panel, {
        Closed: () => ({ model }),
        Open: panel =>
          panel.cardId === cardId
            ? {
                model: modifyFields(model, {
                  panel: () =>
                    modifyFields(panel, {
                      card: () =>
                        Option.match(maybeCard, {
                          onNone: () => PanelCard.Missing(),
                          onSome: card => PanelCard.Found({ card }),
                        }),
                    }),
                }),
              }
            : { model },
      }),

    SkippedLoadPanelCard: () => ({ model }),

    CompletedAnchorCardPanel: () => ({ model }),

    ClickedStepQuantity: ({ printingId, step }) => ({
      model,
      outMessage: OutMessage.SteppedQuantity({ printingId, step }),
    }),

    ClickedRetryCollection: () => ({
      model,
      outMessage: OutMessage.RequestedCollectionRetry(),
    }),
  })
