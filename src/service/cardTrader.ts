import { Context, Effect, Layer, Option, Redacted, Schema } from 'effect'
import { FetchHttpClient, HttpClient, HttpClientRequest } from 'effect/http'
import { KeyValueStore } from 'effect/persistence'

import { BrowserKeyValueStore } from '@effect/platform-browser'

const API_BASE_URL = 'https://api.cardtrader.com/api/v2'
const TOKEN_STORAGE_KEY = 'cardtrader-token'
const HTTP_UNAUTHORIZED = 401
const HTTP_FORBIDDEN = 403
const HTTP_TOO_MANY_REQUESTS = 429

// TOKEN

export const CardTraderToken = Schema.String.check(
  Schema.isPattern(/^[A-Za-z0-9._-]{20,}$/),
).pipe(Schema.brand('CardTraderToken'))
export type CardTraderToken = typeof CardTraderToken.Type

export const parseToken = (
  raw: string,
): Option.Option<Redacted.Redacted<CardTraderToken>> =>
  Option.map(Schema.decodeOption(CardTraderToken)(raw.trim()), Redacted.make)

const StoredTokenJson = Schema.fromJsonString(
  Schema.Struct({ token: CardTraderToken }),
)

export type StoredToken = Readonly<{
  token: Redacted.Redacted<CardTraderToken>
  isRemembered: boolean
}>

export class TokenStore extends Context.Service<
  TokenStore,
  {
    readonly read: Effect.Effect<Option.Option<StoredToken>>
    readonly save: (
      token: Redacted.Redacted<CardTraderToken>,
      isRemembered: boolean,
    ) => Effect.Effect<void>
    readonly clear: Effect.Effect<void>
  }
>()('cardtrader/service/TokenStore') {
  static readonly layer = Layer.effect(
    TokenStore,
    Effect.gen(function* () {
      const tab = yield* KeyValueStore.KeyValueStore.pipe(
        Effect.provide(BrowserKeyValueStore.layerSessionStorage),
      )
      const device = yield* KeyValueStore.KeyValueStore.pipe(
        Effect.provide(BrowserKeyValueStore.layerLocalStorage),
      )

      const readFrom = (
        store: KeyValueStore.KeyValueStore,
        isRemembered: boolean,
      ): Effect.Effect<Option.Option<StoredToken>> =>
        store.get(TOKEN_STORAGE_KEY).pipe(
          Effect.flatMap(maybeJson =>
            Option.match(Option.fromNullishOr(maybeJson), {
              onNone: () => Effect.succeed(Option.none<StoredToken>()),
              onSome: json =>
                Schema.decodeEffect(StoredTokenJson)(json).pipe(
                  Effect.map(({ token }) =>
                    Option.some({ token: Redacted.make(token), isRemembered }),
                  ),
                ),
            }),
          ),
          Effect.orElseSucceed(() => Option.none<StoredToken>()),
        )

      const clear = Effect.all([
        tab.remove(TOKEN_STORAGE_KEY),
        device.remove(TOKEN_STORAGE_KEY),
      ]).pipe(Effect.ignore)

      return TokenStore.of({
        read: readFrom(tab, false).pipe(
          Effect.flatMap(maybeTabToken =>
            Option.isSome(maybeTabToken)
              ? Effect.succeed(maybeTabToken)
              : readFrom(device, true),
          ),
        ),
        save: (token, isRemembered) =>
          Effect.gen(function* () {
            yield* clear
            const json = yield* Schema.encodeEffect(StoredTokenJson)({
              token: Redacted.value(token),
            })
            yield* (isRemembered ? device : tab).set(TOKEN_STORAGE_KEY, json)
          }).pipe(Effect.ignore),
        clear,
      })
    }),
  )
}

// CLIENT

export const AppInfo = Schema.Struct({
  id: Schema.Int,
  name: Schema.String,
  user_id: Schema.Int,
})
export type AppInfo = typeof AppInfo.Type

export const CardTraderFailure = Schema.Literals([
  'InvalidToken',
  'RateLimited',
  'Unavailable',
])
export type CardTraderFailure = typeof CardTraderFailure.Type

export class CardTraderError extends Schema.TaggedError<CardTraderError>()(
  'CardTraderError',
  { reason: CardTraderFailure },
) {}

export const failureForStatus = (status: number): CardTraderFailure => {
  if (status === HTTP_UNAUTHORIZED || status === HTTP_FORBIDDEN) {
    return 'InvalidToken'
  } else if (status === HTTP_TOO_MANY_REQUESTS) {
    return 'RateLimited'
  } else {
    return 'Unavailable'
  }
}

export class CardTraderClient extends Context.Service<
  CardTraderClient,
  {
    readonly info: (
      token: Redacted.Redacted<CardTraderToken>,
    ) => Effect.Effect<AppInfo, CardTraderError>
  }
>()('cardtrader/service/CardTraderClient') {
  static readonly layerWith = Layer.effect(
    CardTraderClient,
    Effect.gen(function* () {
      const client = yield* HttpClient.HttpClient

      const get = (path: string, token: Redacted.Redacted<CardTraderToken>) =>
        client
          .execute(
            HttpClientRequest.get(`${API_BASE_URL}${path}`).pipe(
              HttpClientRequest.bearerToken(token),
              HttpClientRequest.acceptJson,
            ),
          )
          .pipe(
            Effect.mapError(
              () => new CardTraderError({ reason: 'Unavailable' }),
            ),
            Effect.flatMap(response =>
              response.status >= 200 && response.status < 300
                ? Effect.succeed(response)
                : Effect.fail(
                    new CardTraderError({
                      reason: failureForStatus(response.status),
                    }),
                  ),
            ),
          )

      return CardTraderClient.of({
        info: Effect.fn('CardTraderClient.info')(function* (token) {
          const response = yield* get('/info', token)
          const body = yield* response.json.pipe(
            Effect.mapError(
              () => new CardTraderError({ reason: 'Unavailable' }),
            ),
          )
          return yield* Schema.decodeUnknownEffect(AppInfo)(body).pipe(
            Effect.mapError(
              () => new CardTraderError({ reason: 'Unavailable' }),
            ),
          )
        }),
      })
    }),
  )

  static readonly layer = CardTraderClient.layerWith.pipe(
    Layer.provide(FetchHttpClient.layer),
  )
}
