import { HttpApiEndpoint, HttpApiGroup } from 'effect/http-api'

import { User } from '../domain'
import { Authentication } from './authentication'

export class Account extends HttpApiGroup.make('account')
  .add(HttpApiEndpoint.get('me', '/api/me', { success: User.User }))
  .middleware(Authentication) {}
