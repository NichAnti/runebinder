import {
  Array,
  Context,
  Effect,
  Layer,
  Option,
  Redacted,
  Result,
  Schema,
} from 'effect'
import { FetchHttpClient, HttpClient, HttpClientRequest } from 'effect/http'
import { KeyValueStore } from 'effect/persistence'

import { BrowserKeyValueStore } from '@effect/platform-browser'

import { CardTraderImport, Wishlist } from '../domain'

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

const CreatedWishlist = Schema.Struct({
  id: Wishlist.CardTraderWishlistId,
})

export type NewWishlist = Readonly<{
  name: string
  lines: Array.NonEmptyReadonlyArray<Wishlist.CardTraderLine>
}>

const wishlistBody = ({ name, lines }: NewWishlist) => ({
  deck: {
    game_id: Wishlist.CARDTRADER_GAME_ID,
    name,
    public: false,
    deck_items_attributes: Array.map(lines, ({ blueprintId, quantity }) => ({
      blueprint_id: blueprintId,
      quantity,
    })),
  },
})

const HTTP_NOT_FOUND = 404
const WISHLIST_PAGE_SIZE = 100

export const ListedWishlist = Schema.Struct({
  id: Wishlist.CardTraderWishlistId,
  name: Schema.String,
})
export type ListedWishlist = typeof ListedWishlist.Type

const ShownWishlist = Schema.Struct({
  id: Wishlist.CardTraderWishlistId,
  name: Schema.String,
  items: Schema.Array(
    Schema.Struct({
      quantity: Schema.Int,
      meta_name: Schema.String,
      expansion_code: Schema.String,
    }),
  ),
})

export class CardTraderClient extends Context.Service<
  CardTraderClient,
  {
    readonly info: (
      token: Redacted.Redacted<CardTraderToken>,
    ) => Effect.Effect<AppInfo, CardTraderError>
    readonly createWishlist: (
      token: Redacted.Redacted<CardTraderToken>,
      wishlist: NewWishlist,
    ) => Effect.Effect<Wishlist.CardTraderWishlistId, CardTraderError>
    readonly deleteWishlist: (
      token: Redacted.Redacted<CardTraderToken>,
      wishlistId: Wishlist.CardTraderWishlistId,
    ) => Effect.Effect<void, CardTraderError>
    readonly listWishlists: (
      token: Redacted.Redacted<CardTraderToken>,
    ) => Effect.Effect<ReadonlyArray<ListedWishlist>, CardTraderError>
    readonly showWishlist: (
      token: Redacted.Redacted<CardTraderToken>,
      wishlistId: Wishlist.CardTraderWishlistId,
    ) => Effect.Effect<CardTraderImport.RemoteWishlist, CardTraderError>
  }
>()('cardtrader/service/CardTraderClient') {
  static readonly layerWith = Layer.effect(
    CardTraderClient,
    Effect.gen(function* () {
      const client = yield* HttpClient.HttpClient

      const unavailable = () => new CardTraderError({ reason: 'Unavailable' })

      const send = (
        request: HttpClientRequest.HttpClientRequest,
        token: Redacted.Redacted<CardTraderToken>,
      ) =>
        client
          .execute(
            request.pipe(
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

      const get = (path: string, token: Redacted.Redacted<CardTraderToken>) =>
        send(HttpClientRequest.get(`${API_BASE_URL}${path}`), token)

      const createWishlist = Effect.fn('CardTraderClient.createWishlist')(
        function* (
          token: Redacted.Redacted<CardTraderToken>,
          wishlist: NewWishlist,
        ) {
          const request = yield* HttpClientRequest.post(
            `${API_BASE_URL}/wishlists`,
          ).pipe(
            HttpClientRequest.bodyJson(wishlistBody(wishlist)),
            Effect.mapError(unavailable),
          )
          const response = yield* send(request, token)
          const body = yield* response.json.pipe(Effect.mapError(unavailable))
          const created = yield* Schema.decodeUnknownEffect(CreatedWishlist)(
            body,
          ).pipe(Effect.mapError(unavailable))
          return created.id
        },
      )

      const deleteWishlist = Effect.fn('CardTraderClient.deleteWishlist')(
        function* (
          token: Redacted.Redacted<CardTraderToken>,
          wishlistId: Wishlist.CardTraderWishlistId,
        ) {
          const response = yield* client
            .execute(
              HttpClientRequest.delete(
                `${API_BASE_URL}/wishlists/${wishlistId}`,
              ).pipe(
                HttpClientRequest.bearerToken(token),
                HttpClientRequest.acceptJson,
              ),
            )
            .pipe(Effect.mapError(unavailable))

          if (
            response.status !== HTTP_NOT_FOUND &&
            (response.status < 200 || response.status >= 300)
          ) {
            return yield* new CardTraderError({
              reason: failureForStatus(response.status),
            })
          }
        },
      )

      const listPage = (
        token: Redacted.Redacted<CardTraderToken>,
        page: number,
      ) =>
        get(
          `/wishlists?game_id=${Wishlist.CARDTRADER_GAME_ID}&page=${page}&limit=${WISHLIST_PAGE_SIZE}`,
          token,
        ).pipe(
          Effect.flatMap(response =>
            response.json.pipe(Effect.mapError(unavailable)),
          ),
          Effect.flatMap(body =>
            Schema.decodeUnknownEffect(Schema.Array(ListedWishlist))(body).pipe(
              Effect.mapError(unavailable),
            ),
          ),
        )

      const listFrom = (
        token: Redacted.Redacted<CardTraderToken>,
        page: number,
        found: ReadonlyArray<ListedWishlist>,
      ): Effect.Effect<ReadonlyArray<ListedWishlist>, CardTraderError> =>
        listPage(token, page).pipe(
          Effect.flatMap(wishlists =>
            Array.length(wishlists) < WISHLIST_PAGE_SIZE
              ? Effect.succeed([...found, ...wishlists])
              : listFrom(token, page + 1, [...found, ...wishlists]),
          ),
        )

      const listWishlists = Effect.fn('CardTraderClient.listWishlists')(
        (token: Redacted.Redacted<CardTraderToken>) => listFrom(token, 1, []),
      )

      const showWishlist = Effect.fn('CardTraderClient.showWishlist')(
        function* (
          token: Redacted.Redacted<CardTraderToken>,
          wishlistId: Wishlist.CardTraderWishlistId,
        ) {
          const response = yield* get(`/wishlists/${wishlistId}`, token)
          const body = yield* response.json.pipe(Effect.mapError(unavailable))
          const shown = yield* Schema.decodeUnknownEffect(ShownWishlist)(
            body,
          ).pipe(Effect.mapError(unavailable))

          return {
            id: shown.id,
            name: shown.name,
            items: Array.filterMap(shown.items, item =>
              item.quantity > 0
                ? Result.succeed({
                    quantity: item.quantity,
                    metaName: item.meta_name,
                    expansionCode: item.expansion_code,
                  })
                : Result.failVoid,
            ),
          }
        },
      )

      return CardTraderClient.of({
        createWishlist,
        deleteWishlist,
        listWishlists,
        showWishlist,
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
