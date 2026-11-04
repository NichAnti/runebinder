import { Array, Data, Effect, Layer, Option, Result, Schema } from 'effect'
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

const PageIds = Schema.Struct({
  data: Schema.Array(Schema.Struct({ id: Schema.String })),
})

// The feed recomputes its list on every request, so if it changes between two
// page requests a card can land on both pages (and another on neither). A
// repeated id means the pages are not one snapshot, and they are fetched again.
class ShiftingPages extends Data.TaggedError('ShiftingPages')<{
  readonly id: string
}> {}

const FETCH_ATTEMPTS = 3

const firstRepeatedId = (
  pages: ReadonlyArray<unknown>,
): Effect.Effect<Option.Option<string>, UnreadableRecording> =>
  Effect.forEach(pages, page =>
    Schema.decodeUnknownEffect(PageIds)(page).pipe(
      Effect.map(({ data }) => Array.map(data, ({ id }) => id)),
      Effect.mapError(
        error => new UnreadableRecording({ message: error.message }),
      ),
    ),
  ).pipe(
    Effect.map(idsPerPage => {
      const ids = Array.flatten(idsPerPage)
      return Array.findFirst(ids, (id, index) => ids.indexOf(id) !== index)
    }),
  )

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
        const pages = yield* Effect.gen(function* () {
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
          const all = [first, ...rest]

          return yield* Option.match(yield* firstRepeatedId(all), {
            onNone: () => Effect.succeed(all),
            onSome: id => Effect.fail(new ShiftingPages({ id })),
          })
        }).pipe(
          Effect.retry({
            times: FETCH_ATTEMPTS - 1,
            while: error => error._tag === 'ShiftingPages',
          }),
          Effect.catchTag('ShiftingPages', ({ id }) =>
            Effect.fail(
              new UnreadableRecording({
                message: `The gallery feed kept changing while it was read (${id} appeared twice in ${FETCH_ATTEMPTS} attempts); try the deploy again`,
              }),
            ),
          ),
        )

        return yield* Result.match(printingsFromPages(pages), {
          onSuccess: Effect.succeed,
          onFailure: issues => Effect.fail(new RejectedRecords({ issues })),
        })
      }),
    })
  }),
).pipe(Layer.provide(FetchHttpClient.layer))
