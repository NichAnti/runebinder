# Agent Development Notes

This is a Foldkit app. Read [`FOLDKIT.md`](./FOLDKIT.md) before writing any code in this project. It covers the architecture, the APIs, and the conventions the project is built on.

Foldkit owns `FOLDKIT.md` and replaces it whole on upgrade. This file is yours. Anything you want an agent to know about this project goes below, where an upgrade won't touch it.

`FOLDKIT.md` reads the line below to decide whether it has already offered to vendor the Foldkit source. Leave it in place.

subtree_prompted: true

## Project Notes

Domain vocabulary, deployment steps, local conventions that differ from Foldkit's defaults: write them here.

- Follow official docs and examples (foldkit.dev, alchemy.run, the `alchemy-run/alchemy` examples). Do not invent patterns. Alchemy v2 is Effect-based; v1 guides do not apply.
- Tooling comes from the Nix flake (`nix develop`): Bun and Node.js. The Bun version in `flake.lock` must match `bun-version` in `.github/workflows/deploy.yml`.
- `effect` and `@effect/platform-*` stay at exactly `4.0.0` (Foldkit's peer pin). `alchemy` is pinned exactly; upgrade it deliberately in its own PR.
- Deployment is `Cloudflare.Website.Foldkit` in `alchemy.run.ts`. API routes live in `src/worker.ts` under `/api` and `/api/*` (`assets.runWorkerFirst`); unknown API paths return 404 JSON, everything else falls through to the SPA.
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
- Organise by feature (`card/`, `collection/`, `deck/`, `wishlist/`, `cardtrader/`, `auth/`), each holding its domain, schemas, and UI. Small files with one reason to change. No `utils`/`helpers` grab-bags.
- Minimal design system in `src/ui/`: design tokens in the Tailwind theme (colour, spacing, type scale, radius) plus a small set of shared components built on `@foldkit/ui`. Pages compose these and never restyle them inline.
- Tests ship with the code: Story and Scene tests per page, unit tests for the pure domain, property-based tests where a domain function has clear laws (e.g. deck code round-trips).
- Sensitive values never enter the Model, logs, or the Worker. The CardTrader token is held as `Redacted` and only in the browser.

### Working Rules

- Propose every change as an exact diff and wait for explicit approval before editing any file.
- Follow the plan in `docs/00-plan.md` one step at a time; wait for approval before starting the next step, and tick the step off when it is done.
- Before the first of anything (design token, UI component, page, route, API route, migration, external client, dependency), propose its scaffolding first: folders, file names, the pattern, and the official example it follows. Later instances follow the agreed pattern.
- Make no changes outside this repository (system config, global tools, dotfiles, agent memory) unless explicitly asked.
- The user runs commands (`nix develop`, `bun`, `git`, deploys) unless they ask the agent to; give exact, copy-pasteable commands.
- Verify against official docs, official example repos, or the installed package source in `node_modules` before stating how something works. Say clearly what is unverified.
- Prefer the official example over a custom approach; when deviating, say so and why.
- Never deploy or destroy `prod` and never push to `main`; changes go through a PR.
