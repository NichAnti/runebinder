import { taggedStruct } from 'foldkit/schema'

import { LoggedOutRoute } from '../../route'

export const Model = taggedStruct('LoggedOut', { route: LoggedOutRoute })
export type Model = typeof Model.Type

export const init = (route: LoggedOutRoute): Model => Model({ route })
