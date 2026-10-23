import { HttpApi } from 'effect/http-api'

import { Account } from './account'
import { Collection } from './collection'
import { System } from './system'

export class Api extends HttpApi.make('cardtrader').add(
  System,
  Account,
  Collection,
) {}
