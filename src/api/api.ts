import { HttpApi } from 'effect/http-api'

import { Account } from './account'
import { Collection } from './collection'
import { Decks } from './deck'
import { System } from './system'

export class Api extends HttpApi.make('cardtrader').add(
  System,
  Account,
  Collection,
  Decks,
) {}
