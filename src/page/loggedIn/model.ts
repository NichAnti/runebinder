import { taggedStruct } from 'foldkit/schema'

import { User } from '../../domain'
import { LoggedInRoute } from '../../route'

export const Model = taggedStruct('LoggedIn', {
  route: LoggedInRoute,
  user: User.User,
})
export type Model = typeof Model.Type

export const init = (route: LoggedInRoute, user: User.User): Model =>
  Model({ route, user })
