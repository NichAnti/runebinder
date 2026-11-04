import { Array, Effect, Layer, Result, Schema } from 'effect'
import { FetchHttpClient, HttpClient } from 'effect/http'

import {
  CatalogueSource,
  RejectedRecords,
  UnreadableRecording,
} from '../source'
import { printingsFromPages } from './fromPages'

// The public feed behind playriftbound.com's card gallery, read page by page.
// For development only: a public app must use the official Riot API.
const GALLERY_URL =
  'https://content.publishing.riotgames.com/publishing-content/v2.0/public/channel/riftbound_website/list/riftbound_gallery_cards'

const PAGE_SIZE = 200

const PageSize = Schema.Struct({
  metadata: Schema.Struct({ totalItems: Schema.Int }),
})

const unreadable = (error: unknown) =>
  new UnreadableRecording({ message: String(error) })

const fetchPage = (client: HttpClient.HttpClient, from: number) =>
  client
    .get(GALLERY_URL, {
      urlParams: { locale: 'en_US', from: `${from}`, limit: `${PAGE_SIZE}` },
    })
    .pipe(
      Effect.flatMap(response => response.json),
      Effect.mapError(unreadable),
    )

export const LiveRiotGallery = Layer.effect(
  CatalogueSource,
  Effect.gen(function* () {
    const client = (yield* HttpClient.HttpClient).pipe(
      HttpClient.filterStatusOk,
    )

    return CatalogueSource.of({
      name: 'RiotGallery',
      printings: Effect.gen(function* () {
        const first = yield* fetchPage(client, 0)
        const { metadata } = yield* Schema.decodeUnknownEffect(PageSize)(
          first,
        ).pipe(Effect.mapError(unreadable))
        const rest = yield* Effect.forEach(
          Array.makeBy(
            Math.max(Math.ceil(metadata.totalItems / PAGE_SIZE) - 1, 0),
            page => (page + 1) * PAGE_SIZE,
          ),
          from => fetchPage(client, from),
        )

        return yield* Result.match(printingsFromPages([first, ...rest]), {
          onSuccess: Effect.succeed,
          onFailure: issues => Effect.fail(new RejectedRecords({ issues })),
        })
      }),
    })
  }),
).pipe(Layer.provide(FetchHttpClient.layer))
