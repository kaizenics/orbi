# ORBI

**Explore more. Plan smarter.**

ORBI is an open-source, self-hostable travel itinerary planner with a map-first design. You plan trips
day by day and see every stop as a numbered marker on a map, connected by real road routes. A local AI
(through [Ollama](https://ollama.com)) can draft and edit itineraries, and you review its suggestions
before anything is saved.

It runs on your own computer and needs no paid accounts or API keys.

> **Status: MVP (Phases 1–6).** Plan trips day by day on a map with real road routes, reorder stops,
> see arrival times and costs, and let AI (OpenRouter or local Ollama) draft or edit itineraries that you
> review before saving. The Android app still needs its first device build. See the [roadmap](./docs/roadmap.md)
> and the [deployment guide](./docs/deployment.md).

## What's in the repository

| Path             | What it is                                                                                                                                                                                        |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web`       | Next.js web app (planner UI)                                                                                                                                                                      |
| `apps/mobile`    | Expo / React Native Android app (iOS later)                                                                                                                                                       |
| `apps/server`    | Node.js process that serves the ORBI API                                                                                                                                                          |
| `packages/core`  | Shared schemas, types and business logic (pure TypeScript)                                                                                                                                        |
| `packages/api`   | The HTTP API (Hono), plus a typed client for the apps                                                                                                                                             |
| `packages/db`    | Database schema, migrations and data access (SQLite + Drizzle)                                                                                                                                    |
| `packages/ai`    | AI providers (OpenRouter, Ollama), prompts and itinerary pipelines                                                                                                                                |
| `packages/geo`   | Geocoding/routing adapters (Nominatim, Photon, OSRM) and shared map utilities                                                                                                                     |
| `packages/theme` | Design tokens shared by web and mobile                                                                                                                                                            |
| `docs/`          | [Product requirements](./docs/PRD.md), [architecture](./docs/architecture.md), [database](./docs/database.md), [technical decisions](./docs/technical-decisions.md), [roadmap](./docs/roadmap.md) |

## Requirements

- **Node.js 26** (see `.nvmrc`). With nvm: `nvm install 26 && nvm use 26`
- **pnpm 11**: `npm install -g pnpm@11`
- For the Android app: **Android Studio** (it provides the Android SDK, an emulator and a JDK)

## Quick start (web + server)

```bash
git clone <this repository> orbi
cd orbi
pnpm install
pnpm dev
```

- Web app: <http://localhost:3000>
- API: <http://127.0.0.1:3100/health>

Load a demo trip ("3 days in Cebu", with coordinates from OpenStreetMap) and open it in the web app:

```bash
pnpm --filter @orbi/server db:seed
```

The web app forwards `/api/*` to the server, so the browser only talks to one address. The server
stores its database in `apps/server/data/orbi.db` (git-ignored) and migrates it automatically on start.
Defaults work out of the box. To change them, copy [`.env.example`](./.env.example) values into
`apps/server/.env` or `apps/web/.env`.

## Android app

The Android app needs a **development build**. Expo Go isn't enough, because the map library (added in
Phase 3) contains native code.

1. Point the shell at Android Studio's tools (PowerShell example; adjust the paths on macOS/Linux):

   ```powershell
   $env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
   $env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
   ```

2. Tell the app where the server is:

   ```bash
   cp apps/mobile/.env.example apps/mobile/.env
   ```

   On the Android emulator use `EXPO_PUBLIC_API_URL=http://10.0.2.2:3100` (the emulator's name for your computer).
   On a real phone, use your computer's LAN IP and start the server with `ORBI_HOST=0.0.0.0`.

3. Start an emulator (or connect a phone with USB debugging), then build and install:

   ```bash
   pnpm --filter mobile android
   ```

   The first build takes a while. Afterwards, `pnpm dev:mobile` starts Metro for the installed app.

## Common commands

| Command                              | What it does                                                                                 |
| ------------------------------------ | -------------------------------------------------------------------------------------------- |
| `pnpm dev`                           | Web app + server with live reload                                                            |
| `pnpm test`                          | Unit and integration tests (Vitest)                                                          |
| `pnpm check-types`                   | TypeScript type-check of every package                                                       |
| `pnpm lint`                          | ESLint, zero warnings allowed                                                                |
| `pnpm boundaries`                    | Checks that packages only import what they declare (e.g. the apps can't import the database) |
| `pnpm --filter @orbi/server db:seed` | Adds the demo trip (skips if it exists)                                                      |
| `pnpm --filter @orbi/db db:generate` | Generates a SQL migration after a schema change                                              |
| `pnpm --filter @orbi/server ai:eval` | Tries the configured AI model on sample prompts                                              |
| `pnpm format`                        | Prettier                                                                                     |
| `pnpm licenses:check`                | Fails if a dependency's licence isn't on the allow-list                                      |

## Deploying

Run the server on a free cloud VM with Docker and HTTPS, and the web app on Vercel: see
[docs/deployment.md](./docs/deployment.md). Vercel and Netlify cannot host the server or Ollama.

## Cost

ORBI's own software and every default service cost nothing. Some defaults are free _public_ services with
fair-use limits (map tiles, geocoding, routing); ORBI caches and rate-limits its requests to them, and they
can all be swapped for self-hosted ones. See [technical decisions §3](./docs/technical-decisions.md#3-cost-classification-0-requirement).

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) and the [Code of Conduct](./CODE_OF_CONDUCT.md).

## License

[AGPL-3.0-or-later](./LICENSE). Map data © OpenStreetMap contributors; see [ATTRIBUTIONS.md](./ATTRIBUTIONS.md).
