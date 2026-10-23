import { Match, Option } from 'effect'
import { Submodel } from 'foldkit'
import type { Html } from 'foldkit/html'

import type { Wishlist } from '../../../../domain'
import { Button, Notice, Toast } from '../../../../ui'
import { type CardTraderInputs, confirmView } from './cardTraderView'
import { detailView } from './detailView'
import { listView } from './listView'
import { Message } from './message'
import type { Model } from './model'
import { type Context, sectionOf, sectionsOf } from './sections'

export type Focus =
  | Readonly<{ _tag: 'All' }>
  | Readonly<{ _tag: 'One'; wishlist: Wishlist.WishlistRef }>

export type ViewInputs = CardTraderInputs &
  Readonly<{
    focus: Focus
    isReady: boolean
    hasFailed: boolean
    context: Context
  }>

export const view = Submodel.defineView<Model, Message, ViewInputs>(
  (model, inputs, h) =>
    h.div(
      [h.Class('flex flex-col gap-6')],
      [
        Match.value(inputs).pipe(
          Match.withReturnType<Html>(),
          Match.when({ hasFailed: true }, () =>
            Notice.view(
              {
                title: 'Your wishlists could not be loaded',
                description: ['Check your connection and try again.'],
                variant: 'Error',
                actions: [
                  Button.view(
                    { content: ['Try again'], onClick: Message.ClickedRetry() },
                    h,
                  ),
                ],
              },
              h,
            ),
          ),
          Match.when({ isReady: true }, () =>
            inputs.focus._tag === 'All'
              ? listView(model, sectionsOf(inputs.context), inputs, h)
              : Option.match(sectionOf(inputs.context, inputs.focus.wishlist), {
                  onNone: () =>
                    Notice.view(
                      {
                        title: 'This wishlist does not exist',
                        description: ['Its deck may have been deleted.'],
                      },
                      h,
                    ),
                  onSome: section => detailView(model, section, inputs, h),
                }),
          ),
          Match.orElse(() =>
            Notice.view(
              { title: 'Loading your wishlists…', description: [] },
              h,
            ),
          ),
        ),
        confirmView(model, h),
        Toast.view(
          {
            slotId: 'wishlist-toast',
            model: model.toast,
            toParentMessage: message => Message.GotToastMessage({ message }),
          },
          h,
        ),
      ],
    ),
)
