import { taggedStruct } from 'foldkit/schema'

import { LoggedOutRoute } from '../../route'
import * as Home from './page/home'
import * as SignIn from './page/signIn'
import * as SignUp from './page/signUp'

export const Model = taggedStruct('LoggedOut', {
  route: LoggedOutRoute,
  home: Home.Model,
  signIn: SignIn.Model,
  signUp: SignUp.Model,
})
export type Model = typeof Model.Type

export const init = (route: LoggedOutRoute): Model =>
  Model({
    route,
    home: Home.init(),
    signIn: SignIn.init(),
    signUp: SignUp.init(),
  })
