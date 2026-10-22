import { taggedStruct } from 'foldkit/schema'

import { LoggedInRoute } from '../../route'

export const Model = taggedStruct('LoggedIn', { route: LoggedInRoute })
export type Model = typeof Model.Type

export const init = (route: LoggedInRoute): Model => Model({ route })
