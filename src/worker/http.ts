import * as Http from 'alchemy/Http'
import { Effect, Layer } from 'effect'
import { HttpApiBuilder } from 'effect/http-api'

import { BrowserCrypto } from '@effect/platform-browser'

import { Api, CurrentUser, Health } from '../api'
import { AuthenticationLive } from './authentication'
import { PrintingCatalogue } from './catalogue/printingCatalogue'
import { CollectionLive } from './collection/http'
import { CollectionRepository } from './collection/repository'
import { DecksLive } from './deck/http'
import { DeckRepository } from './deck/repository'
import { WishlistLive } from './wishlist/http'
import { WishlistRepository } from './wishlist/repository'

export const SystemLive = HttpApiBuilder.group(Api, 'system', handlers =>
  handlers.handle('health', () => Effect.succeed(Health.make({ ok: true }))),
)

export const AccountLive = HttpApiBuilder.group(Api, 'account', handlers =>
  handlers.handle('me', () =>
    Effect.gen(function* () {
      return yield* CurrentUser
    }),
  ),
)

export const HttpLive = HttpApiBuilder.layer(Api).pipe(
  Layer.provide([
    SystemLive,
    AccountLive,
    CollectionLive,
    DecksLive,
    WishlistLive,
  ]),
  Layer.provide([
    AuthenticationLive,
    CollectionRepository.layer,
    DeckRepository.layer.pipe(Layer.provide(BrowserCrypto.layer)),
    WishlistRepository.layer,
    PrintingCatalogue.layer,
  ]),
  Layer.provide(Http.Platform),
)
