import * as Cloudflare from 'alchemy/Cloudflare'
import { Effect, Layer } from 'effect'
import { HttpRouter, HttpServerRequest } from 'effect/http'

import { AUTH_BASE_PATH, Auth, AuthLive } from './auth'
import { AppDatabase } from './database'
import { HttpLive } from './http'

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

    return {
      fetch: Effect.gen(function* () {
        const request = yield* HttpServerRequest.HttpServerRequest
        const { pathname } = new URL(request.url, 'http://localhost')

        if (isAuthPath(pathname)) {
          return yield* auth.fetch
        } else {
          return yield* http
        }
      }),
    }
  }).pipe(Effect.provide(AuthLive.pipe(Layer.provideMerge(AppDatabase.layer)))),
) {}
