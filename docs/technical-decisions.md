# ORBI — Technical Decisions

> Status: Draft for approval · Last updated: 2026-11-08
> Format: lightweight ADRs. **Status** is `Proposed` until the owner approves; `Open` means a decision is explicitly requested.
> Versions are _as researched on 2026-11-08_ and must be re-verified when installing (Phase 1+). Nothing is installed yet.

## 0. Repository inspection (Phase 0 findings)

The repository is **not empty** — it is an unmodified `create-turbo` starter (one commit, `45c2e1f`):

| Item                                                   | Finding                                                                                                                                                                                                           | Action proposed                                                         |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `apps/web`, `apps/docs`                                | Next.js 16.3.8 demo apps (React 19.2.8)                                                                                                                                                                           | Keep `web` (replace content), delete `docs`                             |
| `packages/ui`                                          | Demo React components                                                                                                                                                                                             | Delete (UI is not shared across platforms)                              |
| `packages/eslint-config`, `packages/typescript-config` | Shared configs; ESLint 10 using **`@babel/eslint-parser`** (not typescript-eslint)                                                                                                                                | Keep, rename scope to `@orbi/*`, extend for Expo/Node                   |
| Root                                                   | pnpm 11.25.0, Turborepo ^2.11.10, **TypeScript 7.0.2**, Prettier 3.9, `engines.node >= 24`                                                                                                                        | Keep; see TD-02                                                         |
| `.turbo-clone-temp/`                                   | **Committed by accident**: a full clone of the Turborepo source repository (Rust/Cargo files, its own `.git`) recorded as a gitlink (mode 160000) with no `.gitmodules`                                           | Remove from index and disk in Phase 1 (needs your OK)                   |
| Local toolchain                                        | Node version manager is pointed at **Node v26.1.0, which is not installed**, so `node`/`pnpm` currently fail in this shell. `nvm list` shows only 22.20.0 and 22.17.1, which are below the repo's `engines >= 24` | Install Node 26 LTS (`nvm install 26` then `nvm use 26`) before Phase 1 |
| `AGENTS.md`                                            | Turborepo-managed agent guidance block (read installed docs before changing turbo config)                                                                                                                         | Keep committed, as it instructs                                         |
| `.npmrc`                                               | Empty                                                                                                                                                                                                             | Keep or remove                                                          |

## 1. Stack compatibility summary

| Area           | Proposed                                                     | Verdict               | Notes                                                                                                            |
| -------------- | ------------------------------------------------------------ | --------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Monorepo       | pnpm workspaces + Turborepo 2.11                             | ✅                    | Already configured                                                                                               |
| Language       | TypeScript (repo pins 7.0.2)                                 | ⚠️                    | TS 7 has no programmatic API until ~7.1 → see TD-02                                                              |
| Web            | Next.js 16.3 + React 19.2 + Tailwind v4 + shadcn/ui + Lucide | ✅                    | Next 16.3 supports TS 7; shadcn supports Tailwind v4                                                             |
| Mobile         | Expo SDK 58 (RN 0.88) + Expo Router                          | ✅                    | SDK 58 needs Node ≥ 24.3 or ≥ 26; dev builds recommended by Expo for new projects anyway                         |
| Mobile styling | NativeWind                                                   | ⚠️                    | NativeWind v5 (Tailwind v4) is **RC**, v4 stable targets Tailwind v3 → TD-08 (**Open**)                          |
| Mobile maps    | `@maplibre/maplibre-react-native` v11                        | ✅ with caveat        | New Architecture only (RN ≥ 0.80), Expo config plugin, **not in Expo Go** → dev build required                   |
| Web maps       | MapLibre GL JS (+ `react-map-gl/maplibre`)                   | ✅                    |                                                                                                                  |
| Backend        | Hono + Zod + `@hono/node-server`                             | ✅                    | Typed RPC client (`hc`) works from Next and Expo; needs consistent `strict`/`moduleResolution` across tsconfigs  |
| DB             | SQLite + Drizzle                                             | ⚠️                    | Drizzle **1.0 is RC** (0.x is stable); driver choice depends on it → TD-05                                       |
| AI             | Vercel AI SDK + Ollama                                       | ✅ with caveat        | Ollama support is a **community provider** (`ai-sdk-ollama` or `ollama-ai-provider-v2`), not first-party → TD-10 |
| Geo            | OSM + Nominatim + OSRM                                       | ✅ with policy limits | Public instances ≈ 1 req/s, no SLA, can be withdrawn → TD-13/14                                                  |
| Tiles          | (not specified)                                              | —                     | Public `tile.openstreetmap.org` raster tiles are **not** suitable as an app default → TD-12                      |

## 2. Decisions

### TD-01 — Monorepo: pnpm workspaces + Turborepo · _Proposed_

Keep the existing setup. Just-in-Time internal packages (TS source exported directly) — no per-package builds. Strict env mode with server env declared in `turbo.json`. Add tasks `test`, `db:generate`, `db:migrate` (uncached). Use `turbo boundaries` (undeclared-dependency check) to keep server-only packages out of apps.
_Phase 1 note:_ the server default port is **3100**, not 8787. Port 8787 was already taken on the owner's machine by a local proxy, and it is a common default for other dev tools.
_Rejected:_ Nx (heavier), plain pnpm scripts (no task graph/caching).
_Expo + pnpm:_ Expo supports pnpm monorepos; Phase 1 verifies Metro resolution with pnpm's isolated `node_modules` and falls back to `node-linker=hoisted` **only if required** (recorded here if so).

### TD-02 — TypeScript 7 for type-checking, no type-aware lint · **Accepted 2026-11-08**

TS 7.0 (Go-native compiler, ~10× faster) is already pinned and supported by Next.js 16.3. Its programmatic API is missing until ~7.1, which breaks tools that import `typescript` as a library — notably **typescript-eslint type-aware rules** and possibly `eslint-config-expo`.
Decision: keep TS 7 for `check-types` (`tsc --noEmit` per package). Keep the scaffold's Babel-parser ESLint setup (syntax-level lint, React Hooks, Turbo env rule); do **not** adopt `eslint-config-expo` if it requires typescript-eslint. If a tool hard-requires the TS API, alias the bridge package `@typescript/typescript6` for that tool only.
**Exception (Phase 1):** `apps/mobile` uses **TypeScript ~6.0.3**, the version Expo SDK 58's template pins, so Expo tooling gets the API it expects. All other packages use TS 7.0.2.
_Alternative:_ pin TypeScript 6.0 everywhere for maximum tool compatibility — simpler, slower. Re-evaluate when TS 7.1 ships.
_Also considered:_ Oxlint/Biome as linter — attractive (fast, no TS API dependency) but adds a second toolchain next to the existing ESLint config; revisit in Phase 6.

### TD-03 — Node.js 26 LTS · _Proposed_

Node 26 entered LTS in October 2026; Expo SDK 58 supports ≥ 26 (and ≥ 24.3). Pin via `.nvmrc`/`.node-version` and `engines`. Node 26 gives built-in TypeScript type stripping and `node:sqlite`.

### TD-04 — Backend: standalone Hono server, not embedded in Next.js · _Proposed_

`packages/api` (Hono app, `AppType`) + `apps/server` (Node process).
_Why not Next.js route handlers?_ Mobile must reach the API independently of the web app; the server must run headless on a home machine/Docker; SQLite/Ollama access shouldn't depend on Next's runtime model. Hono is tiny, standards-based (Fetch API), fast and has a typed RPC client.
_Why not tRPC?_ Hono RPC gives the same end-to-end types while keeping plain REST URLs that are curl-able and documentable for self-hosters.
Web uses Next.js rewrites to the server for same-origin calls.

### TD-05 — SQLite driver and Drizzle version · _Proposed (verify in Phase 2)_

Default: **latest stable Drizzle ORM 0.x + `better-sqlite3`** (synchronous, fastest, mature, best Drizzle Kit support). Pre-condition: prebuilt binaries for the chosen Node version on Windows (otherwise a native build toolchain is needed — friction for contributors).
Fallback: **Drizzle 1.0 (if stable by Phase 2) + `node:sqlite`** (built into Node, zero native compilation). At the time of writing Drizzle Kit's `node:sqlite` support was reported buggy in 1.0 betas, so it is not the default yet.
_Rejected for MVP:_ libSQL (useful mainly for Turso/hosted replication, which conflicts with $0/no-cloud defaults; note Expo SDK 58 also removed libSQL from `expo-sqlite`), PostgreSQL (operational overhead with no MVP benefit).

### TD-06 — IDs: UUIDv7 strings · _Proposed_

Time-sortable, generated client- or server-side, portable to Postgres `uuid`, sync-friendly. (`crypto.randomUUID` is v4; a tiny v7 generator in `core` or the `uuid` package.)

### TD-07 — Web UI: Next.js App Router + Tailwind v4 + shadcn/ui + Lucide · _Proposed_

As specified. shadcn components are copied into `apps/web` (owned code, Radix-based accessibility). Server state with **TanStack Query** (justified: caching, optimistic reorder, retries); no Redux/Zustand. Drag-and-drop with **`@dnd-kit`** (keyboard sensor for a11y). Map with **`react-map-gl/maplibre`** (declarative sources/layers; MIT, vis.gl).
_Considered:_ Vite SPA served by the Hono server (one process, simpler self-hosting). Not chosen because the spec prefers Next and shadcn/Next tooling is first-class; kept as a fallback if Next adds friction (e.g. static export for self-hosting).

### TD-08 — Mobile styling · **Accepted 2026-11-08: NativeWind**

**Decision (owner):** use NativeWind. As of 2026-11-08 npm `latest` is 4.2.7 (Tailwind v3) and v5 is `5.0.0-rc.1` (Tailwind v4, with `react-native-css` 3.1.0-rc.1). We use **NativeWind v5 pinned to an exact RC version** so mobile shares Tailwind v4 and the `@orbi/theme` `@theme` tokens with web. We move to v5 stable when it ships. If the RC blocks Phase 1 acceptance (Metro/pnpm or Expo SDK incompatibility), fall back to v4.2.x stable with a Tailwind v3 config generated from the same tokens, and record that here.

Options considered:
Options:

1. **NativeWind v5 (RC) + Tailwind v4** — same `@theme` tokens and utility vocabulary as web; risk: pre-release, breaking changes possible before stable.
2. **NativeWind v4 (stable) + Tailwind v3 in `apps/mobile` only** — stable, but two Tailwind majors in one repo and tokens must be duplicated in JS config.
3. **React Native `StyleSheet` + typed tokens from `@orbi/theme`** — zero styling dependency, most predictable; more verbose.
   Tokens live in `@orbi/theme` either way.

### TD-09 — Mobile platform specifics · _Proposed_

Expo **development builds** from day one (MapLibre Native requires them). Expo Router; `@gorhom/bottom-sheet`; a reorderable list (`react-native-reorderable-list` or equivalent, chosen in Phase 4 after checking New-Architecture support) **plus** explicit “Move up/down/to day” actions for accessibility; `expo-secure-store` for server URL/token; `expo-linking` for external navigation.
**iOS cost/feasibility risk:** building iOS locally needs macOS + Xcode. EAS Build has a free tier with limited monthly builds (free hosted service with limits). Installing a build on a physical iPhone beyond 7-day free provisioning (which itself needs Xcode/macOS) requires the **Apple Developer Program ($99/year)**.
**Decision (owner, 2026-11-08): Android-first.** The owner has no Mac. The native app targets Android only for the MVP, and iPhone users use the responsive web app installed as a PWA. The code stays iOS-compatible (no Android-only APIs without a platform check), but iOS builds are not part of any acceptance criteria until a Mac or a paid Apple account is available.

### TD-10 — AI: Vercel AI SDK + Ollama via community provider · _Proposed_

AI SDK (current major at Phase 5) for a provider-neutral `LanguageModel` interface, structured output with Zod, tool calling, streaming and a mock model for tests. Ollama provider: **`ai-sdk-ollama`** (built on the official `ollama` client; better tool-calling handling) with `ollama-ai-provider-v2` as alternative — final pick in Phase 5 after a spike.
Generation is a **server-orchestrated pipeline** (extract → suggest → geocode → route → validate), not a free-running agent, because small local models are unreliable at multi-step tool use. Tool calling is used opportunistically for edits. One repair retry on schema failure.
Adding providers later (OpenAI-compatible endpoints such as llama.cpp/LM Studio/vLLM, or hosted APIs) = one entry in the provider registry; never required.

### TD-11 — AI never supplies coordinates · _Proposed_

AI output schemas contain **no latitude/longitude fields**. Places are resolved by the geocoder with region bias and validated (inside trip bbox, name similarity, category match). Unresolved places stay in the proposal flagged “needs location”. Opening hours/prices from AI are stored as `ai_estimate` and labelled in the UI.

### TD-12 — Map tiles: OpenFreeMap by default, self-hosted PMTiles as the fully-local option · _Proposed_

- Default style: **OpenFreeMap** public instance (MapLibre vector styles, no API key, no registration, no stated request limits; provided as-is and may change). Attribution required (OpenFreeMap, OpenMapTiles, © OpenStreetMap contributors).
- Self-hosted: **Protomaps PMTiles** — a single file (a regional extract such as the Philippines is a manageable size) served by `apps/server` with HTTP range requests; or self-host OpenFreeMap.
- **Not** the default: `tile.openstreetmap.org` (raster, governed by the OSMF tile usage policy, meant for light use, no SLA). Allowed only as a manual configuration.
- Tile source is delivered to clients via `/config` → switching providers needs no app rebuild.
  _Verify in Phase 3:_ PMTiles support in the MapLibre Native version used by the RN SDK (otherwise serve tiles as `{z}/{x}/{y}` via the server).

### TD-13 — Geocoding & search: Nominatim (submit-based) + Photon (type-ahead), server-side only · _Proposed_

Public **Nominatim** policy: max 1 request/second **across all users of the app**, identifying User-Agent required, no heavy/bulk use, and client-side autocomplete is discouraged/forbidden. Therefore:

- Search is **submit-on-enter** (or ≥ 600 ms debounce with min 3 chars) against Nominatim, cached in `geocode_cache`, queued at ≤ 1 req/s.
- Optional **Photon** provider (komoot public instance, fair use; or self-hosted) for type-ahead suggestions.
- Self-hosting: Nominatim via the `mediagis/nominatim` Docker image with a country extract (Geofabrik), or self-hosted Photon. Documented in `docs/self-hosting.md` (Phase 6).
- Nearby discovery by category (P1): **Overpass API** (public instances also rate-limited) or Photon/Nominatim category search — decided in Phase 4/5.

### TD-14 — Routing: OSRM, one endpoint per profile · _Proposed_

Default: the **FOSSGIS-run OSRM demo** (`routing.openstreetmap.de`, car/bike/foot profiles). Its policy: reasonable non-commercial use, ≤ 1 req/s, no SLA, access can be withdrawn. Mitigated by whole-day requests + per-leg cache (database.md §6).
Self-hosting: `osrm-backend` Docker with a regional extract; **one preprocessed dataset per profile** (car, foot), modest RAM for a country like the Philippines.
Optimisation: OSRM `trip` service (TSP heuristic) or local nearest-neighbour + 2-opt on an OSRM `table` matrix.
_Alternative kept behind the interface:_ Valhalla (multi-modal from one dataset, better for walking + time-dependent costing) — candidate if walking/cycling quality matters more later.
**Never** present straight lines as routes (dashed + labelled fallback).

### TD-15 — API contract: Hono RPC types + Zod schemas from `core` · _Proposed_

`@hono/zod-validator` on every route, response types inferred into `AppType`. Clients import types only. Errors as RFC 9457 problem+json. Optimistic concurrency via `trips.revision`.

### TD-16 — Remote access: private overlay network, not public exposure · _Proposed_

Recommended: Tailscale (free personal tier — a free hosted service with limits) or Headscale (self-hosted). The API is protected by a bearer token whenever not bound to loopback. Cloudflare Tunnel documented as an alternative with stronger warnings.

### TD-17 — Licence: **AGPL-3.0-or-later** · **Accepted 2026-11-08**

Contributions are accepted under the DCO (`Signed-off-by`) plus a relicensing grant stated in CONTRIBUTING.md, so the owner can still offer a dual-licensed SaaS later.

| Licence                                                                                                                                                                                 | Fits “self-hostable + future SaaS”                                                                                                  | Trade-off                                                                                                                                                        |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **AGPL-3.0** (recommended)                                                                                                                                                              | Anyone running a modified ORBI as a network service must publish their changes → protects against closed SaaS forks of your project | Some companies avoid AGPL code; to keep the option of a proprietary/dual-licensed SaaS yourself, accept contributions under a **CLA or DCO + relicensing grant** |
| Apache-2.0                                                                                                                                                                              | Maximises adoption and contributions; explicit patent grant                                                                         | Anyone may run a closed SaaS on your code                                                                                                                        |
| MIT                                                                                                                                                                                     | Simplest, most permissive                                                                                                           | Same as Apache, without patent grant                                                                                                                             |
| Recommendation: AGPL-3.0 for the applications/server; optionally MIT for small generic packages (e.g. `geo` utils) if you want them reusable. Decide before the repository goes public. |

### TD-18 — Data licensing & attribution · _Proposed_

- **OpenStreetMap data** — ODbL 1.0. Must display “© OpenStreetMap contributors” (linked to the copyright page) on every map. Caches built from OSM data are derivative databases; share-alike obligations only matter if ORBI is offered publicly — documented for future SaaS.
- **OpenFreeMap / OpenMapTiles** — attribution as provided in the style.
- **Nominatim** (GPL-2.0 software), **OSRM** (BSD-2-Clause), **Photon** (Apache-2.0), **MapLibre GL JS / Native** (BSD-3-Clause / BSD-2-Clause), **Ollama** (MIT) — server software licences don't affect ORBI's licence when used over the network or via Docker.
- **LLM weights** — licences vary per model (Apache-2.0, Llama Community Licence, Gemma terms…). Documented per recommended model; no weights in the repo.
- Phase 1 adds a dependency licence check (`pnpm licenses list` reviewed; disallow unknown/proprietary licences) and an `ATTRIBUTIONS.md`.

### TD-19 — Testing: Vitest + Playwright (+ jest-expo for mobile) · _Proposed_

Vitest for all packages and API integration tests (in-memory SQLite, `app.request()`); recorded HTTP fixtures for geo providers (no network in CI); AI SDK mock model for pipelines. Playwright E2E on web in Phase 6. `jest-expo` (Expo's supported preset) for mobile components.

### TD-20 — Formatting & linting · _Proposed_

Keep Prettier (already present) and the shared ESLint flat config (TD-02). Add `prettier-plugin-tailwindcss` for class ordering on web. Husky/lint-staged pre-commit is optional (Phase 1, ask).

## 3. Cost classification ($0 requirement)

| Item                                                                                                                                                                     | Class                                            | Notes                                                                                                        |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| TypeScript, Node, pnpm, Turborepo, Next.js, React, Expo SDK & CLI, Hono, Zod, Drizzle, SQLite, MapLibre, AI SDK, Ollama, shadcn/ui, Tailwind, Lucide, Vitest, Playwright | **1. Free software** (OSS)                       |                                                                                                              |
| Running server, SQLite, Ollama, web app, Android emulator/dev build on own machine                                                                                       | **2. Free local development**                    | Uses own hardware/electricity                                                                                |
| Turborepo local cache                                                                                                                                                    | 2                                                | Remote cache (Vercel) not needed                                                                             |
| OpenFreeMap public tiles                                                                                                                                                 | **3. Free hosted service, usage-limited/no SLA** | Donation-funded; may change                                                                                  |
| Public Nominatim (OSMF), Photon (komoot), Overpass, FOSSGIS OSRM demo                                                                                                    | **3**                                            | ~1 req/s, no SLA, revocable                                                                                  |
| Tailscale personal plan, Cloudflare Tunnel                                                                                                                               | **3**                                            | Optional; free tiers may change                                                                              |
| EAS Build free tier                                                                                                                                                      | **3**                                            | Only needed for iOS builds without a Mac / cloud Android builds                                              |
| GitHub public repo + Actions for public repos                                                                                                                            | **3**                                            |                                                                                                              |
| Self-hosted Nominatim / Photon / OSRM / PMTiles / Headscale                                                                                                              | **4. Self-hosted, needs hardware**               | Regional extracts: a few GB disk; OSRM/Nominatim RAM in the low-GB range for one country (verify per region) |
| Ollama models                                                                                                                                                            | **4**                                            | 8B-class model: ~8 GB RAM/VRAM comfortable; larger models need more                                          |
| Apple Developer Program ($99/yr)                                                                                                                                         | **5. Potential future cost**                     | Needed for durable iOS device installs / App Store                                                           |
| Google Play developer account (one-time $25)                                                                                                                             | **5**                                            | Only for Play Store distribution; sideloading APKs is free                                                   |
| VPS for always-on remote access, domain name, hosted AI APIs, hosted Postgres, commercial geocoding/routing                                                              | **5**                                            | Only for future SaaS/scale; never required                                                                   |

No paid service is introduced by this plan.

## 4. Risk register

| Risk                                                                       | Likelihood         | Impact  | Mitigation                                                                                     |
| -------------------------------------------------------------------------- | ------------------ | ------- | ---------------------------------------------------------------------------------------------- |
| TS 7 API gap breaks a tool (eslint-config-expo, drizzle-kit, Expo typegen) | Medium             | Low–Med | TD-02 fallback alias / pin TS 6                                                                |
| NativeWind v5 RC instability                                               | Medium             | Medium  | TD-08 option 3                                                                                 |
| Drizzle 1.0 RC churn                                                       | Medium             | Medium  | Use stable 0.x unless 1.0 is stable; migrations are plain SQL                                  |
| pnpm + Metro resolution issues                                             | Low–Med            | Medium  | Expo's monorepo guide; hoisted linker fallback                                                 |
| Public OSM services throttle/withdraw                                      | Medium             | High    | Cache, 1 req/s queue, provider config, self-hosting docs                                       |
| Local model quality/speed insufficient                                     | Medium             | High    | Pipeline design, validation, eval set, model configurable, optional OpenAI-compatible provider |
| iOS distribution cost                                                      | High (without Mac) | Medium  | Android-first + PWA (TD-09)                                                                    |
| Home server offline while travelling                                       | Medium             | Medium  | Read-only offline cache; overlay network                                                       |
| React version skew between Next and Expo in one pnpm workspace             | Low–Med            | Medium  | Align React versions where possible; each app declares its own `react`; verify in Phase 1      |

## 5. Owner decisions (2026-11-08)

| #   | Question             | Answer                                                                                                                    |
| --- | -------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| 1   | TD-17 Licence        | AGPL-3.0-or-later ✅                                                                                                      |
| 2   | TD-08 Mobile styling | NativeWind ✅ (v5 RC pinned; v4 fallback)                                                                                 |
| 3   | TD-09 iOS            | Android-first; no Mac available ✅                                                                                        |
| 4   | TD-02 TypeScript     | Keep TypeScript 7 ✅                                                                                                      |
| 5   | Phase 1 cleanup      | Approved: delete `.turbo-clone-temp/`, `apps/docs`, `packages/ui`; rename to `@orbi/*` ✅                                 |
| 6   | Ollama hardware      | **Still open.** The owner asked whether 2 GB RAM is enough. It is not enough for useful itinerary generation (see TD-21). |

### TD-21 — AI hardware floor · **Open**

- **2 GB of system RAM:** not viable. The OS, Node server and SQLite already use most of it, so no useful model fits beside them.
- **2 GB of GPU VRAM (with ≥ 8 GB system RAM):** workable but slow. Ollama splits a 3B–4B model (Q4, ~2.5–3 GB) between GPU and CPU. Expect it to need the repair retry more often and to produce weaker suggestions.
- **Tiny models (~0.5B–1.5B, ~1 GB):** run almost anywhere, but are unreliable at multi-day structured JSON. They are only a fallback.
- **Comfortable target:** 16 GB system RAM, or ≥ 6–8 GB VRAM, for an 8B-class model.
- **Mitigation:** AI is optional by design. Every non-AI feature works without it. The Phase 5 spike benchmarks the owner's actual hardware. If local inference is inadequate, an _optional_ OpenAI-compatible provider entry (e.g. a free hosted tier: class 3, usage-limited, may change) can be configured. It is never required and never the default.

## 6. Prior art: TREK

[TREK](https://github.com/liketrek/TREK) is an open-source, self-hosted travel planner (React 19 + Vite, NestJS, SQLite, MapLibre/Leaflet, OSRM/Valhalla), licensed **AGPL-3.0**, the same licence as ORBI. Its code may be studied and, with attribution and licence notices kept, reused. The owner suggested it as an MVP reference on 2026-11-09.

Ideas that confirm decisions already in this plan:

- Day auto-sort by nearest neighbour + 2-opt, with locked stops staying in place (TD-14 `LocalOptimizer`).
- AI changes shown as cards the user applies or discards (TD-11, `ai_proposals`).
- Per-leg travel modes over OSRM or Valhalla (TD-14).
- Money in integer minor units (database.md §2); OpenFreeMap with no token (TD-12).

Ideas to evaluate in later phases (not committed):

- Undo for itinerary edits (Phase 4), e.g. a short undo window after AI apply.
- Drop a map marker directly onto a day (Phase 4, PRD D8).
- Place descriptions/photos from Wikipedia/Wikidata/Wikimedia Commons (Phase 3/5, free, attribution required).
- Downloadable map tiles for offline use (post-MVP).

Deliberately out of ORBI's MVP scope (TREK has these): multi-user collaboration and real-time sync, bookings, packing lists, journaling, plugins, hosted-AI-only assistants.

## 7. Implementation notes (Phases 2–3, 2026-11-09)

- **TD-05 resolved:** Drizzle ORM **0.45.4** (stable) + **better-sqlite3 13.0.3**. better-sqlite3 13 ships N-API prebuilds for Windows/macOS/Linux inside the package, so no C++ toolchain is needed; its install script is disabled in `pnpm-workspace.yaml` (`allowBuilds`). Drizzle 1.0 was still RC5.
- **Repositories own transactions.** Every mutation runs in one transaction that checks the optional `If-Match` revision and bumps `trips.revision`. API routes call repositories directly; services exist only where providers are orchestrated (places, routing).
- **Web data:** TanStack Query over the typed Hono client. `unwrap()` (in `@orbi/api/client`) turns problem+json responses into `ApiError` and narrows the success type.
- **Web proxy:** Next.js 16 `proxy.ts` forwards `/api/*` to the server and adds `ORBI_API_TOKEN` server-side, so the token never reaches the browser.
- **Web map:** `@vis.gl/react-maplibre` 8 (the MapLibre-only build of react-map-gl) + `maplibre-gl` 6. MapLibre 6 locates its web worker relative to its own module URL, which breaks once Turbopack bundles it; `app/vendor/maplibre-gl-worker.mjs/route.ts` serves the worker from the installed package and the map calls `setWorkerUrl()`.
- **Shared map data:** `buildMapFeatures()` in `@orbi/geo/utils` produces the GeoJSON for both apps; markers and numbers are map layers (circle + symbol, font "Noto Sans Bold" from the OpenFreeMap glyphs), not DOM views.
- **Route caching as designed:** legs keyed by provider, mode and coordinates rounded to 5 decimals; a cache miss fetches each run of consecutive uncached same-mode legs in one OSRM request. Verified live: a reorder or added stop triggers one request covering only the new legs.
- **Unrouted legs never show invented numbers:** totals exclude them, and the UI says "No road route available" when no leg has road data (`formatRouteTotals`).
- **Mobile map:** `@maplibre/maplibre-react-native` 11.5.1 (config plugin registered). Written and bundled, but not yet run on a device because the Android native build is blocked (see roadmap, Phase 1).
- **Demo data provenance:** seed coordinates were fetched once from public Nominatim (1 req/s, identifying User-Agent) and stored with their OSM references; nothing is hand-typed.

### Security notes (2026-11-09, from an automated review of the Phase 2–3 commits)

- **Web proxy path escape (fixed):** the `/api` proxy now builds the upstream URL on the fixed API origin and rejects `//` or `\` paths, so the bearer token can never be sent to another host.
- **Unauthenticated web gateway (fixed):** the web app has no login (single-user MVP) while its proxy adds the API token, so `next dev`/`next start` now listen on `127.0.0.1` only. Exposing the web app on a network would publish the API without authentication; a real login is needed first (multi-user work, post-MVP).
- **Import limits (fixed):** trip files are capped by the schema (60 days, 40 stops per day, 500 places); import rebuilds day numbers and dates from the trip and reports duplicates as validation errors.
- **Token in the mobile bundle (accepted for now):** `EXPO_PUBLIC_API_TOKEN` is compiled into the APK, so anyone holding the APK can extract it. This is acceptable only for a personal, sideloaded build that never leaves the owner's devices. Phase 6 replaces it with a token entered at runtime and stored in `expo-secure-store`; if the APK is shared, rotate `ORBI_API_TOKEN`.

## 8. Implementation notes (Phases 4–6, 2026-11-09)

- **Schedule is derived, never stored:** `computeDaySchedule` (core) chains day start, visit durations and routed leg times, waits for fixed arrivals, and returns `null` times after an unrouted leg until a fixed time re-anchors the clock. Warnings: fixed time missed, past day end, too much travel.
- **Reordering:** web uses `@dnd-kit` (pointer + keyboard sensor) with an optimistic update and rollback; moving between days is a "Move to day" control. Mobile uses Move up/down/to-day actions; long-press drag is deferred until the app runs on a device.
- **Accessibility:** axe found the theme's muted text at 4.47:1; `--muted-foreground` darkened to `#6b6a66` (≥ 4.5:1).
- **AI (TD-10 revised):** AI SDK 7 with `generateText` + `Output.object` (`generateObject` is deprecated in v7). Providers: `@openrouter/ai-sdk-provider` and `ai-sdk-ollama`, selected by `AI_PROVIDER`/`AI_MODEL`; AI is off when unset. One repair retry with the validation error; unreachable model → 503, two invalid answers → 502 `ai_output_invalid`.
- **AI safety rails:** model schemas have no coordinate fields (tested); every place is geocoded and matches farther than 150 km from the trip area become "needs location"; the model refers to stops by short refs (`s3`, `d2`) that the server maps to IDs, unknown refs are rejected rather than guessed. Proposals are stored in `ai_proposals` and applied in one transaction against `base_revision` (409 + `stale` if the trip changed).
- **Long AI requests:** the Next.js `/api` proxy defaults to a 30 s timeout; raised to 180 s (`experimental.proxyTimeout`).
- **Web login (deployment prerequisite):** `ORBI_WEB_PASSWORD` enables a signed, HTTP-only session cookie (HMAC keyed by the password; 30 days). The proxy fails closed when `ORBI_API_TOKEN` is set without a web password.
- **MapLibre worker** is now copied to `public/vendor/` by `scripts/copy-maplibre-worker.mjs` (run by `dev` and `build`) instead of a route handler that read `node_modules` at runtime, which Vercel would not have bundled.
- **Deployment:** `apps/server/Dockerfile` installs production dependencies only (`--prod --ignore-scripts`, filtered to the server) and runs the TypeScript sources directly; `infra/docker-compose.yml` adds Caddy for automatic HTTPS and an optional Ollama profile. Docker was not available on the development machine; the image steps were replayed manually (install, start, migrate, create a trip). See [deployment.md](./deployment.md).

## 9. Vercel + Turso + Google sign-in (2026-11-09, owner decision)

- **Hosting changed:** the owner chose to run the API on Vercel with Turso instead of a VM. The Hono app is mounted in Next.js (`app/api/[[...route]]/route.ts`) and built from env by `createAppFromEnv` (`@orbi/api`), which the standalone server (`apps/server`, Docker/VM) shares. Setting `ORBI_API_URL` switches the web app back to forwarding `/api` to a separate server.
- **TD-05 revised — libSQL:** the database layer moved from `better-sqlite3` (synchronous) to Drizzle's libSQL driver (`@libsql/client`), which supports local files (development, VM) and Turso. All repositories are now async; multi-step operations still run in one transaction. Local files migrate on open (with a `VACUUM INTO` backup); remote databases are migrated explicitly with `pnpm --filter @orbi/db db:migrate`, so serverless cold starts never run migrations. On Vercel a `file:` database is rejected at startup.
- **Sign-in:** Google OAuth 2.0 authorization code flow with PKCE and state, implemented directly (no auth library). The ID token is received from Google's token endpoint over TLS and its audience, issuer, expiry and `email_verified` are checked; only `ORBI_ALLOWED_EMAILS` may sign in, and the allow-list is re-checked on every request. Sessions are HMAC-signed cookies keyed by a value derived from `GOOGLE_CLIENT_SECRET` (since 2026-11-09; no separate session secret). This replaces the password login. Single-user data model unchanged (no users table).
- **Fail-closed rules:** without Google sign-in configured, the app refuses to serve trips on Vercel or when forwarding a token to an external API. Browser calls get the API token added server-side; the Android app sends its own bearer token.
- **Known limits:** in-memory rate limiting is per serverless instance (the database cache absorbs repeats); reordering on Turso costs one network round trip per position update.
- **Landing page** at `/` (public); the planner moved to `/trips`.

## 10. Bring your own AI key (2026-11-09, owner decision)

- **Ollama and server-wide AI settings removed.** Each signed-in user connects their own provider in Settings: OpenRouter, OpenAI, Anthropic or Google (official AI SDK providers). AI features work once a user has saved a key; without one, the AI panel links to Settings and everything else works.
- **Storage (revised same day, owner decision):** the key lives only in the user's browser (localStorage) and is sent in the body of each draft/edit request; the API builds a model for that request and neither stores nor logs it. No server secret is needed (`ORBI_ENCRYPTION_KEY` dropped), the provider list is fixed (no custom base URLs, so no SSRF), and the key must be re-entered per browser. Trade-off: any script on the site could read localStorage, so no third-party scripts.
- **Trips stay shared** among the allowed Google accounts; `ORBI_ALLOWED_EMAILS` remains the only access control until per-user trips exist.
- **Errors:** a provider rejecting the key (401/403) becomes "Your AI provider rejected the API key. Check it in Settings."
- **Fix found while testing:** Hono's body-limit middleware failed on body-less requests (e.g. `DELETE`) coming through Next.js; it now applies only to POST/PUT/PATCH.
- `pnpm --filter @orbi/server ai:eval` now takes `AI_EVAL_PROVIDER`, `AI_EVAL_MODEL` and `AI_EVAL_API_KEY`.

## 11. Per-account trips (2026-11-09, owner decision)

- **Each Google account has its own trips.** `trips.owner` holds the account email (migration `0001_trip_owner`); existing rows and trips made without sign-in belong to `local`, so trips created before sign-in are not visible to signed-in accounts.
- **Identity:** the web proxy removes any `x-orbi-user` header the browser sent and sets it from the verified Google session. The API scopes trip lists by it and checks, for every route that takes a trip, destination, day, item or proposal ID, that the record's trip belongs to the caller; other accounts get 404 so IDs are not revealed. Owner emails never appear in responses or exported files.
- **Shortcut:** a caller holding `ORBI_API_TOKEN` (the Android app) may set `x-orbi-user` itself; the token is an owner-level secret.
- **Fewer secrets:** `ORBI_SESSION_SECRET` dropped (the cookie key is derived from `GOOGLE_CLIENT_SECRET`); `ORBI_ALLOWED_EMAILS` removed: ORBI is public and any Google account can sign in.
