import { Context, Effect, Layer } from 'effect'
import { FetchHttpClient } from 'effect/http'
import { HttpApiClient } from 'effect/http-api'

import { Api } from '../api'

export class ApiClient extends Context.Service<
  ApiClient,
  HttpApiClient.ForApi<typeof Api>
>()('runebinder/service/ApiClient') {
  static readonly layer = Layer.effect(
    ApiClient,
    Effect.gen(function* () {
      const origin = yield* Effect.sync(() => window.location.origin)
      return yield* HttpApiClient.make(Api, { baseUrl: origin })
    }),
  ).pipe(Layer.provide(FetchHttpClient.layer))
}
