import * as Cloudflare from 'alchemy/Cloudflare'
import { Config, Effect, Layer, Option } from 'effect'
import { HttpRouter, HttpServerRequest, HttpServerResponse } from 'effect/http'

import { INVALID_INVITE_CODE, INVITE_CODE_HEADER } from '../api'
import { AUTH_BASE_PATH, Auth, AuthLive } from './auth'
import { AppDatabase } from './database'
import { HttpLive } from './http'
import { isInviteCodeValid, isSignUpPath } from './invite'

const isAuthPath = (pathname: string): boolean =>
  pathname === AUTH_BASE_PATH || pathname.startsWith(`${AUTH_BASE_PATH}/`)

export default class Backend extends Cloudflare.Worker<Backend>()(
  'Backend',
  {
    main: import.meta.url,
    workersDev: false,
    compatibility: { flags: ['nodejs_compat'] },
  },
  Effect.gen(function* () {
    const auth = yield* Auth
    const http = yield* HttpRouter.toHttpEffect(HttpLive)
    const inviteCode = yield* Config.Redacted('INVITE_CODE')

    const rejectedInvite = HttpServerResponse.jsonUnsafe(
      {
        code: INVALID_INVITE_CODE,
        message: 'Sign-up needs a valid invite code.',
      },
      { status: 403 },
    )

    return {
      fetch: Effect.gen(function* () {
        const request = yield* HttpServerRequest.HttpServerRequest
        const { pathname } = new URL(request.url, 'http://localhost')

        if (isSignUpPath(pathname)) {
          const isInvited = yield* isInviteCodeValid(
            inviteCode,
            Option.fromNullishOr(request.headers[INVITE_CODE_HEADER]),
          )

          return isInvited ? yield* auth.fetch : rejectedInvite
        } else if (isAuthPath(pathname)) {
          return yield* auth.fetch
        } else {
          return yield* http
        }
      }),
    }
  }).pipe(Effect.provide(AuthLive.pipe(Layer.provideMerge(AppDatabase.layer)))),
) {}
