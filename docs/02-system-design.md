# System design (MVP)

```mermaid
flowchart LR
  subgraph Browser
    SPA[Foldkit SPA]
    Token[(CardTrader token<br>sessionStorage or localStorage)]
  end

  subgraph Cloudflare["Cloudflare (Alchemy)"]
    Gateway[Website Worker<br>src/worker/gateway.ts]
    Assets[Static assets]
    Backend[Backend Worker<br>src/worker/backend.ts]
    Auth[Better Auth /api/auth/*]
    Api[HttpApi /api/*]
    Seed[CatalogueSeed<br>runs on deploy]
    Bucket[(R2 runebinder-data)]
    DB[(D1 AppDb)]
  end

  Source[CatalogueSource<br>Riot gallery · Riftcodex · Riot API]
  CardTrader[CardTrader API]

  SPA -->|same origin| Gateway
  Gateway -->|everything else| Assets
  Gateway -->|/api/* via service binding| Backend
  Backend --> Auth
  Backend --> Api
  Auth --> DB
  Api --> DB
  Seed -->|only if the version is missing| Source
  Seed -->|catalogue| Bucket
  Backend -->|/api/catalogue, card ids| Bucket
  SPA -->|Bearer user token| CardTrader
  SPA --- Token
```

## Components

| Component      | Where                    | Does                                                                                                          |
| -------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------- |
| Foldkit SPA    | `src/` (client code)     | The whole UI. Talks only to its own origin and, with the user's token, to CardTrader.                         |
| Website Worker | `src/worker/gateway.ts`  | Serves the static assets and forwards `/api` and `/api/*` to the Backend.                                     |
| Backend Worker | `src/worker/backend.ts`  | Private (no public URL). Runs Better Auth and the `HttpApi`.                                                  |
| API contract   | `src/api/`               | `HttpApi` definition shared by the Backend and the browser's `ApiClient`.                                     |
| Catalogue seed | `src/worker/catalogue/`  | Runs on deploy: if the bucket lacks the catalogue version, reads the sources, checks the data and uploads it. |
| AppDb          | D1, `src/worker/schema/` | One database for Better Auth's tables and the app's tables. Drizzle defines both.                             |

## What lives where

| Data                                         | Where                                              | Reaches our server? |
| -------------------------------------------- | -------------------------------------------------- | ------------------- |
| Account (display name, email, password hash) | D1 (Better Auth)                                   | yes                 |
| Session                                      | D1 + cookie                                        | yes                 |
| Card catalogue                               | R2 bucket `runebinder-data`, served by the Backend | yes                 |
| Collection, decks, wishlist                  | D1                                                 | yes                 |
| CardTrader token                             | user's browser only                                | **never**           |

## Why

- **Gateway plus private Backend:** Alchemy's full-stack example pattern. The browser only talks to its own origin, so session cookies work and there is no CORS.
- **Catalogue in R2, seeded on deploy:** it is the same for every user, changes only with a new version, and can't be committed (Riot's data). The deploy seeds it like a database seed; the browser downloads it once per version (about 170 KB compressed), searches it locally with Orama and caches it forever, so browsing costs no D1 reads. The Backend streams it without parsing (the Free plan allows 10 ms CPU) and reads only the small printing-types file to check ids.
- **Free plan only:** the Workers Free plan has hard caps (requests fail, nothing is billed). The design keeps every user action to a handful of small requests.
- **Swappable card sources:** a public app may only use Riot's official API ([policy](https://developer.riotgames.com/policies/riftbound)), which our key cannot reach yet. Until then the same `CatalogueSource` service is implemented by recorded responses from Riot's gallery feed (and later Riftcodex), for development only.
- **CardTrader from the browser:** its API allows calls from any site (`access-control-allow-origin: *`, `authorization` allowed), so the user's token never passes through our Workers.
- **One database:** Better Auth's tables live next to ours, so foreign keys and cascades work (deleting an account deletes its data).

## Secrets

- `RIOT_API_KEY`: the Riot Developer Portal key, used only by the official-API `CatalogueSource` layer once a key has access.
- Better Auth's signing secret is generated and kept by Alchemy (`Alchemy.Random`).
- `INVITE_CODE`: the code sign-up needs while the app is invite only. Read by the Backend at startup, so Alchemy binds it as a Worker secret; locally from `.env`, in CI from the repository secret.
- `CARDTRADER_TOKEN`: the developer's CardTrader token, read only by the deploy's catalogue seed (locally from `.env`, in CI from the repository secret). It never reaches a Worker.
