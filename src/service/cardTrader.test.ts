import { Effect, Layer, Option, Redacted, Ref } from 'effect'
import {
  HttpClient,
  type HttpClientRequest,
  HttpClientResponse,
} from 'effect/http'
import { describe, expect, test } from 'vitest'

import { assert, layer } from '@effect/vitest'

import { Printing, Wishlist } from '../domain'
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
    const seenRequest = yield* Ref.make(
      Option.none<HttpClientRequest.HttpClientRequest>(),
    )

    const client = HttpClient.make(request =>
      Effect.all([
        Ref.set(
          seenAuthorization,
          Option.fromNullishOr(request.headers['authorization']),
        ),
        Ref.set(seenRequest, Option.some(request)),
      ]).pipe(
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
      seenRequest,
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

const bodyOf = (request: HttpClientRequest.HttpClientRequest): unknown =>
  request.body._tag === 'Uint8Array'
    ? JSON.parse(new TextDecoder().decode(request.body.body))
    : undefined

describe('CardTraderClient wishlists', () => {
  test('a new wishlist is private, for Riftbound, one line per blueprint', () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const fake = yield* fakeCardTrader(201, { id: 3572164, items: [] })
        const id = yield* Effect.gen(function* () {
          const client = yield* CardTraderClient
          return yield* client.createWishlist(tokenOrThrow(), {
            name: 'Riftbound decks',
            lines: [
              {
                blueprintId: Printing.CardTraderBlueprintId.make(345245),
                quantity: 2,
              },
            ],
          })
        }).pipe(Effect.provide(fake.layer))
        const request = yield* Ref.get(fake.seenRequest)

        expect(id).toBe(3572164)
        expect(Option.map(request, bodyOf)).toStrictEqual(
          Option.some({
            deck: {
              game_id: Wishlist.CARDTRADER_GAME_ID,
              name: 'Riftbound decks',
              public: false,
              deck_items_attributes: [{ blueprint_id: 345245, quantity: 2 }],
            },
          }),
        )
      }),
    ))

  test('deleting a wishlist that is already gone is fine', () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const fake = yield* fakeCardTrader(404, { error_code: 'not_found' })

        yield* Effect.gen(function* () {
          const client = yield* CardTraderClient
          yield* client.deleteWishlist(
            tokenOrThrow(),
            Wishlist.CardTraderWishlistId.make(3572164),
          )
        }).pipe(Effect.provide(fake.layer))
      }),
    ))
})

describe('CardTraderClient wishlist list', () => {
  test('lists Riftbound wishlists with their names', () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const fake = yield* fakeCardTrader(200, [
          { id: 3572164, name: 'Vi aggro (cardtrader app)', game_id: 22 },
        ])
        const wishlists = yield* Effect.gen(function* () {
          const client = yield* CardTraderClient
          return yield* client.listWishlists(tokenOrThrow())
        }).pipe(Effect.provide(fake.layer))
        const request = yield* Ref.get(fake.seenRequest)

        expect(wishlists).toStrictEqual([
          { id: 3572164, name: 'Vi aggro (cardtrader app)' },
        ])
        expect(Option.map(request, ({ url }) => url)).toStrictEqual(
          Option.some(
            'https://api.cardtrader.com/api/v2/wishlists?game_id=22&page=1&limit=100',
          ),
        )
      }),
    ))
})
