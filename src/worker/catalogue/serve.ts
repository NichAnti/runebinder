import { RuntimeContext } from 'alchemy'
import type * as Cloudflare from 'alchemy/Cloudflare'
import { Effect, Option } from 'effect'
import { HttpServerResponse } from 'effect/http'

import { CATALOGUE_PATH, catalogueKey } from '../../api'

const VERSION = /^[0-9a-z-]{1,40}$/

/** The catalogue version a request asks for, if it is a catalogue request. */
export const catalogueVersionOf = (pathname: string): Option.Option<string> =>
  pathname.startsWith(`${CATALOGUE_PATH}/`)
    ? Option.filter(
        Option.some(pathname.slice(CATALOGUE_PATH.length + 1)),
        version => VERSION.test(version),
      )
    : Option.none()

// Each version has its own address and never changes, so browsers keep it.
// The bytes go through untouched: parsing 1.6 MB here would not fit the Free
// plan's CPU limit, and the browser decodes it anyway.
export const serveCatalogue = (
  bucket: Cloudflare.R2.ReadBucketClient,
  version: string,
): Effect.Effect<HttpServerResponse.HttpServerResponse> =>
  bucket.get(catalogueKey(version)).pipe(
    Effect.map(object =>
      object === null
        ? HttpServerResponse.empty({ status: 404 })
        : HttpServerResponse.stream(object.body, {
            contentType: 'application/json',
            headers: {
              'cache-control': 'public, max-age=31536000, immutable',
            },
          }),
    ),
    Effect.orDie,
    Effect.provide(RuntimeContext.phantom),
  )
