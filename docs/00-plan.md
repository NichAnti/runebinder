# MVP plan

Work happens on the `mvc` branch, locally, without pushing.

## How each step works

1. The agent proposes the exact diff, or for 🗣 steps a short scaffolding proposal: folders, file names, the pattern, and which official example it follows.
2. The user approves or changes it.
3. The agent implements only what was approved.
4. The user runs `bun run check`.
5. The user reviews and commits on `mvc`.

🗣 marks a first of its kind (first token, component, page, API route, …).
Its structure is agreed before any code is written.

## Phase 0: Foundations

- [x] 0.1 Engineering standards and this workflow in `AGENTS.md`
- [x] 0.2 Vendor the Foldkit source into `repos/foldkit` (user runs `git subtree add`)
- [x] 0.3 Study the official examples: Foldkit auth / routing / kanban / website, Effect `ai-docs`, Alchemy D1 and secrets
- [x] 0.4 🗣 Project folder layout

## Phase 1: Design system

- [x] 1.1 🗣 Design tokens in the Tailwind theme: colour, spacing, type, radius
- [x] 1.2 🗣 First component on `@foldkit/ui`: location, API, tests
- [ ] 1.3 Further components only when a page needs them

## Phase 2: App shell

- [x] 2.1 🗣 Routing and page structure (Foldkit auth example): `LoggedOut | LoggedIn` root Model, the whole app behind sign-in
- [x] 2.2a Shell: layout, LoggedOut and LoggedIn shells with placeholder pages, routing and route guards
- [x] 2.2b Theme toggle and nav

## Phase 3: Backend foundation and sign-in

- [x] 3.1 🗣 Worker structure with Effect and Alchemy, first API route, request/response schemas shared with the client
- [x] 3.2 🗣 D1 and migration conventions (Drizzle, one database)
- [x] 3.3 🗣 Better Auth email and password, sign-up and sign-in pages, session check at startup

## Phase 4: Card catalogue

- [x] 4.1 🗣 Domain: `PrintingId`, `CardId`, `Printing`, grouping printings into cards; Riot gallery schema, mapping and checks against the committed recording; pure, with tests
- [x] 4.2 🗣 `CatalogueSource` service with a recorded Riot gallery layer; `bun run catalogue:build` writes the committed `catalogue/catalogue.json`; a test fails when it is out of date
- [x] 4.3 🗣 `Catalogue` browser service: loads `catalogue.json` as a hashed static asset, Orama index; catalogue page (search, facet filters with counts, one row per card) and card page

## Phase 5: CardTrader test

- [x] 5.1 Record CardTrader's Riftbound data once (games, expansions, blueprints; about 8 calls, confirmed before running) into `catalogue/recordings/cardtrader/`
- [x] 5.2 Map printings to CardTrader blueprints at catalogue build time (`blueprint_id` stored in `catalogue.json`; unmatched printings listed by the build). Revisit if CardTrader's data changes often
- [x] 5.3 🗣 Connect CardTrader page: token in the browser only (tab or remembered), never in the Model or our backend; `CardTraderClient` exposes only read and wishlist calls
- [x] 5.4 Update `03-data-and-flows.md` with what we learn

## Phase 6: Collection

- [x] 6.1 Pin `@effect/sql-d1` to `4.0.0` (direct dependency and `overrides`); `catalogue:build` also writes `catalogue/printingIds.json`, which the Backend imports to check printing ids, with a test that both files agree
- [x] 6.2 `collection_item` table and migration; `GET /api/collection` and `PUT /api/collection/{printingId}` (`0` removes; unknown printings rejected); `CollectionRepository` over `Drizzle.D1`
- [x] 6.3 Client collection: loaded the first time a screen shows owned amounts, kept for the visit, reloaded only on Refresh or after an error; changes update the screen at once and save one idempotent request per printing after a short pause; `QuantityStepper` component
- [x] 6.4 Card page: owned amount per printing with − / +
- [x] 6.5 Card panel: hovering (pointer) or tapping a card tile opens a panel with every printing of the card, owned amounts and − / +, and a link to the card page; it stays open while the pointer is on the tile or the panel and closes on leave or Esc
- [x] 6.6 Catalogue: "Owned n" on each card (all printings combined) and an All / Owned / Not owned filter
- [ ] 6.7 Collection page `/collection`: summary (copies, printings owned per set out of the set's total), the owned cards with the catalogue's search and filters, Refresh

## Phase 7: Decks

- [ ] 7.1 🗣 Deck-code library as a dependency, conversion and round-trip tests
- [ ] 7.2 Migration, API, deck list, deck view, per-printing detail
- [ ] 7.3 Official deckbuilding rules enforced in the deck builder (required by Riot's policy)

## Phase 8: Missing cards and wishlist

- [ ] 8.1 Missing-cards calculation, pure with tests
- [ ] 8.2 Wishlist page: manual items, send to CardTrader. Sending creates a new private CardTrader wishlist first, then deletes the previous one this app created (its id is kept per user in D1); the user is warned that edits made on CardTrader to that wishlist are replaced. Each line sends `blueprint_id` and `collector_number`, because CardTrader documents `blueprint_id` alone as setting only the card name and expansion, which might not pin the exact printing

## Phase 9: Finishing the MVP

- [ ] 9.1 Card page "used in decks" section and hover
- [ ] 9.2 Polish and docs refresh
- [x] 9.3 Riot "Legal Jibber Jabber" notice in the app (site footer, added in 4.3)
- [ ] 9.4 Register the product on the Riot Developer Portal and apply for a production key
- [ ] 9.5 Decide about a PR

## Follow-ups (not scheduled)

- Further `CatalogueSource` layers: Riftcodex (recorded + live) and the official Riot API (live, once a key has access).

- Fail `bun run check` (and CI) when the Drizzle schema has changes without a committed migration, so CI never generates and applies an unreviewed one.
- Show an error when sign-out fails instead of doing nothing.
- Prevent the flash of the light theme on first load (inline script in `index.html`).
- Split the app bundle (536 KB, 171 KB compressed) so the catalogue's search code (Orama) loads only when needed; Vite warns above 500 KB.

## Inputs needed from the user

- Look and feel (theme, colours, sites you like): by 1.1
- Riot development key in a local `.env` (`RIOT_API_KEY`): by 4.2
- CardTrader token, pasted into the app: in 5.2
