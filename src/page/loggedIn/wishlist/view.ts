import { Submodel } from 'foldkit'

import { Button, Notice } from '../../../ui'
import { Message } from './message'
import type { Model } from './model'
import { failedSaveCount } from './update'

export const view = Submodel.defineView<Model, Message>((model, h) => {
  const count = failedSaveCount(model)

  return count === 0
    ? h.empty
    : Notice.view(
        {
          title: 'Some wishlist changes were not saved',
          description: [
            count === 1
              ? '1 change could not be saved.'
              : `${count} changes could not be saved.`,
            ' They are kept here until they are.',
          ],
          variant: 'Error',
          actions: [
            Button.view(
              {
                content: ['Try again'],
                onClick: Message.ClickedRetryItemSaves(),
              },
              h,
            ),
          ],
        },
        h,
      )
})
