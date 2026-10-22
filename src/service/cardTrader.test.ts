import { Effect, Layer, Option, Redacted, Ref } from 'effect'
import { HttpClient, HttpClientResponse } from 'effect/http'
import { describe, expect, test } from 'vitest'

import { assert, layer } from '@effect/vitest'

import {
  CardTraderClient,
  CardTraderError,
  TokenStore,
  failureForStatus,
  parseToken,
} from './cardTrader'

const TOKEN = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ0ZXN0In0.signature-value'

const tokenOrThrow = () => Option.getOrThrow(parseToken(TOKEN))

const fakeCardTrader = (status: number, body: unknown) =>
  Effect.gen(function* () {
    const seenAuthorization = yield* Ref.make(Option.none<string>())

    const client = HttpClient.make(request =>
      Ref.set(
        seenAuthorization,
        Option.fromNullishOr(request.headers['authorization']),
      ).pipe(
        Effect.as(
          HttpClientResponse.fromWeb(
            request,
            new Response(JSON.stringify(body), { status }),
          ),
        ),
      ),
    )

    return {
      seenAuthorization,
      layer: CardTraderClient.layerWith.pipe(
        Layer.provide(Layer.succeed(HttpClient.HttpClient, client)),
      ),
    }
  })

describe('parseToken', () => {
  test('accepts a token and trims surrounding space', () => {
    expect(Option.isSome(parseToken(`  ${TOKEN}  `))).toBe(true)
  })

  test.each(['', 'short', 'has spaces in the middle of it'])(
    'rejects %j',
    raw => {
      expect(parseToken(raw)).toStrictEqual(Option.none())
    },
  )
})

describe('failureForStatus', () => {
  test.each([
    [401, 'InvalidToken'],
    [403, 'InvalidToken'],
    [429, 'RateLimited'],
    [500, 'Unavailable'],
  ])('%i is %s', (status, reason) => {
    expect(failureForStatus(status)).toBe(reason)
  })
})

describe('CardTraderClient.info', () => {
  test('keeps only the app identity and sends the token as a bearer', () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const fake = yield* fakeCardTrader(200, {
          id: 7,
          name: 'Test App',
          user_id: 42,
          shared_secret: 'must-not-survive',
        })
        const info = yield* Effect.gen(function* () {
          const client = yield* CardTraderClient
          return yield* client.info(tokenOrThrow())
        }).pipe(Effect.provide(fake.layer))

        expect(info).toStrictEqual({ id: 7, name: 'Test App', user_id: 42 })
        expect(yield* Ref.get(fake.seenAuthorization)).toStrictEqual(
          Option.some(`Bearer ${TOKEN}`),
        )
      }),
    ))

  test('a rejected token is an InvalidToken error', () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const fake = yield* fakeCardTrader(401, { error: 'Unauthorized' })
        const result = yield* Effect.gen(function* () {
          const client = yield* CardTraderClient
          return yield* client.info(tokenOrThrow())
        }).pipe(Effect.provide(fake.layer), Effect.flip)

        expect(result).toStrictEqual(
          new CardTraderError({ reason: 'InvalidToken' }),
        )
      }),
    ))
})

layer(TokenStore.layer)('TokenStore', it => {
  it.effect('remembers on the device, or only for the tab, and forgets', () =>
    Effect.gen(function* () {
      const store = yield* TokenStore

      yield* store.save(tokenOrThrow(), true)
      const remembered = yield* store.read
      assert.isTrue(
        Option.exists(remembered, ({ isRemembered }) => isRemembered),
      )
      assert.isTrue(
        Option.exists(
          remembered,
          ({ token }) => Redacted.value(token) === TOKEN,
        ),
      )

      yield* store.save(tokenOrThrow(), false)
      assert.isTrue(
        Option.exists(yield* store.read, ({ isRemembered }) => !isRemembered),
      )
      assert.isNull(globalThis.localStorage.getItem('cardtrader-token'))

      yield* store.clear
      assert.deepStrictEqual(yield* store.read, Option.none())
    }),
  )
})
