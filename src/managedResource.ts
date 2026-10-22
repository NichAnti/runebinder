import { Match, Option } from 'effect'
import { ManagedResource } from 'foldkit'

import { Message } from './message'
import type { Model } from './model'
import { LoggedIn } from './page'

export const managedResources = ManagedResource.lift(LoggedIn.managedResources)<
  Model,
  Message
>({
  read: model =>
    Match.value(model.auth).pipe(
      Match.tagsExhaustive({
        LoggedOut: () => Option.none(),
        LoggedIn: loggedIn => Option.some(loggedIn),
      }),
    ),
  toParentMessage: message => Message.GotLoggedInMessage({ message }),
})
