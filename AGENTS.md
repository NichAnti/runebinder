# Agent Development Notes

This is a Foldkit app. Read [`FOLDKIT.md`](./FOLDKIT.md) before writing any code in this project. It covers the architecture, the APIs, and the conventions the project is built on.

Foldkit owns `FOLDKIT.md` and replaces it whole on upgrade. This file is yours. Anything you want an agent to know about this project goes below, where an upgrade won't touch it.

`FOLDKIT.md` reads the line below to decide whether it has already offered to vendor the Foldkit source. Leave it in place.

subtree_prompted: true

## Project Notes

Domain vocabulary, deployment steps, local conventions that differ from Foldkit's defaults: write them here.

- Follow official docs and examples (foldkit.dev, alchemy.run, the `alchemy-run/alchemy` examples). Do not invent patterns. Alchemy v2 is Effect-based; v1 guides do not apply.
- Tooling comes from the Nix flake (`nix develop`): Bun and Node.js. The Bun version in `flake.lock` must match `bun-version` in `.github/workflows/deploy.yml`.
- `effect` and every `@effect/*` package stay at exactly `4.0.0` (Foldkit's peer pin). `alchemy` is pinned exactly; upgrade it deliberately in its own PR.
- Deployment is `Cloudflare.Website.Foldkit` in `alchemy.run.ts`. Its entry `src/worker/gateway.ts` forwards `/api` and `/api/*` (`assets.runWorkerFirst`) to the private `Backend` Effect Worker (`src/worker/backend.ts`) over the `API` service binding; everything else falls through to the SPA. The API contract is the `HttpApi` in `src/api/`.
- Stages: `dev_<user>` (local `bun run dev`), `pr-<n>` (PR previews), `prod` (pushes to `main`). Only CI deploys or destroys `prod`.
- Run `bun run check` before pushing; CI runs the same script before every deploy.

### Engineering Standards

- Production quality from the first line, MVP included. Scope can be small; quality cannot.
- Sources of truth, in order: installed package source (`node_modules/effect/src` with its `AGENTS.md` and `ai-docs/`, `node_modules/alchemy/src`, `repos/foldkit/`), official examples (Foldkit `examples/`, `alchemy-run/alchemy` examples at the tag matching the pinned version), official docs (foldkit.dev, alchemy.run, effect.website). Name the source a pattern comes from in the proposal.
- FOLDKIT.md conventions apply everywhere, not just in Foldkit code.
- Effect end to end, in the client and in the Worker. Errors are typed values, not thrown exceptions. Dependencies are services provided by layers. No `any`, no casts.
- Parse, don't validate. Every boundary decodes input once with Effect Schema into a domain type: HTTP request and response bodies, D1 rows, Riftcodex and CardTrader responses, routes and query params, browser storage, deck codes. Code past the boundary only accepts parsed types.
- Identifiers are branded types with smart constructors (`CardCode`, `DeckId`, `UserId`), never bare strings.
- Make illegal states unrepresentable: tagged unions, `Option`, non-empty arrays.
- Functional core, imperative shell. Domain logic (card codes, printing grouping, missing-card counts, deck code conversion) is pure, has no I/O, and lives in its own modules. Side effects live only in Commands (client) and Effect services (Worker).
- One API contract. Request and response schemas live in a shared module that both the Worker and the client import. Never redeclare a shape.
- Folder layout follows Foldkit's project organization: `page/<name>/` per page, `domain/` for pure Schema + operations, `ui/` for the design system, `service/` for outside-world clients used by Commands, `api/` for the shared HttpApi contract, `worker/` for the Worker. Imports point inward: `domain` ← `api` ← `service`/`worker`; `page` may use `domain`, `ui`, `service`; `worker` never imports client code. Small files with one reason to change. No `utils`/`helpers` grab-bags.
- Minimal design system in `src/ui/`: design tokens in the Tailwind theme (colour, spacing, type scale, radius) plus a small set of shared components built on `@foldkit/ui`. Pages compose these and never restyle them inline.
- Tests ship with the code: Story and Scene tests per page, unit tests for the pure domain, property-based tests where a domain function has clear laws (e.g. deck code round-trips).
- Sensitive values never enter the Model, logs, or the Worker. The CardTrader token is held as `Redacted` and only in the browser.

### UI Components

- Design tokens live only in `src/ui/tokens.css`. Palette variables are private to it; components use the semantic utilities (`bg-surface`, `text-fg`, `border-border`, …). Tailwind's default colours are disabled.
- One file per component in `src/ui/`, re-exported as a namespace from `src/ui/index.ts`.
- API: `view(config, h)` with a `ViewConfig` type. Content goes in through named slots (`ReadonlyArray<Html | string>` or `Html`); appearance through `variant` (and `size` when needed).
- Styles live in a `recipe` in the component file: `base`, `variants`, `defaults`, and `compound` when needed. Multi-part components have one recipe per slot.
- Every rendered part carries `data-slot`.
- Behaviour and accessibility come from `@foldkit/ui`. Its `toView` render callback is used inside `src/ui/` and never exposed to pages.
- No `className` from callers. A new look is a new variant.
- Scene tests drive a fixture app (`<component>.fixture.ts`) and cover behaviour, not appearance.

### Riot Policy

- Card data comes only from Riot's official API (`riftbound-content-v1`), as Riot's [Riftbound policy](https://developer.riotgames.com/policies/riftbound) requires: "Your App may only use Riftbound assets (including cards) provided by the Riot API." No Riftcodex, gallery scraping or other unofficial sources.
- Show the official English card text unchanged. The deck builder must enforce the official deckbuilding rules.
- The Riot API key is a Worker secret, never in code or in the browser.
- No monetization, no win-rate or metagame statistics, no reselling Riot data. The app shows Riot's "Legal Jibber Jabber" notice.

### Database

- One Cloudflare D1 database, `AppDb`, holds Better Auth's tables and the app's tables, so foreign keys and cascades work across them.
- Drizzle is the only way to define and query the database. Tables live in `src/worker/schema/` (Better Auth's tables in `auth.ts`, generated with `npx auth@1.7.5 generate` against `@better-auth/drizzle-adapter/relations-v2`). `Drizzle.Schema` generates migrations into `migrations/` from those tables; commit them and never edit them by hand.
- `drizzle-orm` and `drizzle-kit` are pinned to exactly the version `alchemy` pins; upgrade them together with `alchemy`.
- App code queries through the Effect handle (`Drizzle.D1`) inside per-feature repository services (`src/worker/<feature>/repository.ts`). Handlers never query directly.
- Rows are parsed at the boundary with schemas derived by `drizzle-orm/effect-schema`, overriding columns with branded domain types (`CardCode`, `UserId`, …).

### Working Rules

- Implement plan steps without asking for approval of each diff. Stop and discuss first only for architectural or design choices (structure, patterns, dependencies, data model, API shape, UX).
- Follow the plan in `docs/00-plan.md` in order and tick each step off when it is done.
- Before the first of anything (design token, UI component, page, route, API route, migration, external client, dependency), propose its scaffolding first: folders, file names, the pattern, and the official example it follows. Later instances follow the agreed pattern.
- Make no changes outside this repository (system config, global tools, dotfiles, agent memory) unless explicitly asked.
- The user runs commands (`nix develop`, `bun`, `git`, deploys) unless they ask the agent to; give exact, copy-pasteable commands.
- Verify against official docs, official example repos, or the installed package source in `node_modules` before stating how something works. Say clearly what is unverified.
- Prefer the official example over a custom approach; when deviating, say so and why.
- Never deploy or destroy `prod` and never push to `main`; changes go through a PR.
