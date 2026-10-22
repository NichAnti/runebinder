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
- [ ] 4.3 🗣 `Catalogue` browser service: loads `catalogue.json` as a hashed static asset, Orama index; catalogue page (search, facet filters with counts, one row per card) and card page
- [ ] 4.4 Further `CatalogueSource` layers: Riftcodex (recorded + live) and the official Riot API (live, once a key has access)

## Phase 5: CardTrader test

- [ ] 5.1 🗣 Token handling: `Redacted`, kept for the tab or remembered on the device, parsed when read back from browser storage
- [ ] 5.2 Test page: paste token, check set codes and printings, create a test wishlist
- [ ] 5.3 Update `03-data-and-flows.md` with what we learn; revise the design if needed

## Phase 6: Collection

- [ ] 6.1 Backend imports `catalogue.json` to check printing ids; migration, API, page to add owned printings

## Phase 7: Decks

- [ ] 7.1 🗣 Deck-code library as a dependency, conversion and round-trip tests
- [ ] 7.2 Migration, API, deck list, deck view, per-printing detail
- [ ] 7.3 Official deckbuilding rules enforced in the deck builder (required by Riot's policy)

## Phase 8: Missing cards and wishlist

- [ ] 8.1 Missing-cards calculation, pure with tests
- [ ] 8.2 Wishlist page: manual items, send to CardTrader

## Phase 9: Finishing the MVP

- [ ] 9.1 Card page "used in decks" section and hover
- [ ] 9.2 Polish and docs refresh
- [ ] 9.3 Riot "Legal Jibber Jabber" notice in the app
- [ ] 9.4 Register the product on the Riot Developer Portal and apply for a production key
- [ ] 9.5 Decide about a PR

## Follow-ups (not scheduled)

- Fail `bun run check` (and CI) when the Drizzle schema has changes without a committed migration, so CI never generates and applies an unreviewed one.
- Show an error when sign-out fails instead of doing nothing.
- Prevent the flash of the light theme on first load (inline script in `index.html`).

## Inputs needed from the user

- Look and feel (theme, colours, sites you like): by 1.1
- Riot development key in a local `.env` (`RIOT_API_KEY`): by 4.2
- CardTrader token, pasted into the app: in 5.2
