import { Context, Schema } from 'effect'
import { HttpApiMiddleware } from 'effect/http-api'

import { User } from '../domain'

export class Unauthorized extends Schema.TaggedError<Unauthorized>()(
  'Unauthorized',
  {},
  { httpApiStatus: 401 },
) {}

export class AuthenticationUnavailable extends Schema.TaggedError<AuthenticationUnavailable>()(
  'AuthenticationUnavailable',
  {},
  { httpApiStatus: 503 },
) {}

export class CurrentUser extends Context.Service<CurrentUser, User.User>()(
  'runebinder/api/CurrentUser',
) {}

export class Authentication extends HttpApiMiddleware.Service<
  Authentication,
  { provides: CurrentUser }
>()('runebinder/api/Authentication', {
  error: [Unauthorized, AuthenticationUnavailable],
}) {}
