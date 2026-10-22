import type { Runtime } from 'foldkit'

import { Message } from './message'
import { Model } from './model'
import { LoggedOut } from './page'
import { AppRoute, urlToAppRoute } from './route'
import { enterRoute } from './update'

export const init: Runtime.RoutingApplicationInit<Model, Message> = url =>
  enterRoute(
    Model.make({ auth: LoggedOut.init(AppRoute.SignIn()) }),
    urlToAppRoute(url),
  )
