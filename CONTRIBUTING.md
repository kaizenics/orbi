# Contributing to ORBI

Thanks for your interest in ORBI! This guide covers how to set up the project, the conventions we follow,
and how contributions are licensed.

## Before you start

- Read the [architecture](./docs/architecture.md) and the [roadmap](./docs/roadmap.md). ORBI is built in
  phases; changes outside the current phase are likely to be deferred.
- For anything bigger than a small fix, open an issue first so we can agree on the approach.
- Be kind. Everyone participating follows the [Code of Conduct](./CODE_OF_CONDUCT.md).

## Development setup

Follow the [README quick start](./README.md#quick-start-web--server). Before opening a pull request, run:

```bash
pnpm lint && pnpm check-types && pnpm test && pnpm boundaries
```

CI runs the same checks.

## Conventions

- **TypeScript everywhere.** The repository uses TypeScript 7 for type-checking (the mobile app uses the
  TypeScript version Expo supports). Internal packages export their `.ts` source directly and have no build step.
- **Relative imports include the `.ts` extension** (`import { x } from "./x.ts"`), so Node.js can run
  the server without a build step. Use only erasable TypeScript syntax: no `enum`, `namespace` or
  constructor parameter properties.
- **Shared logic lives in packages, not in apps.** Schemas and business rules go in `@orbi/core`; the apps
  only render and call the API. The apps must never import `@orbi/db` (enforced by `pnpm boundaries`).
- **Validation with Zod.** Types are derived from schemas (`z.infer`), not written twice.
- **No new dependencies without a reason.** Mention why in the pull request. Every dependency must pass
  `pnpm licenses:check`.
- **Mobile dependencies:** add Expo-ecosystem packages with `npx expo install <pkg>` inside `apps/mobile`,
  so versions match the Expo SDK.
- **Never commit** `.env` files, databases (`*.db`), map/routing extracts or API keys.
- **Tests:** new logic in packages comes with Vitest tests next to the code (`*.test.ts`).

## Commit messages

Use [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `docs:`, `chore:` …)
and sign off every commit (see below).

## Licensing of contributions

ORBI is licensed under the [GNU AGPL-3.0-or-later](./LICENSE).

By contributing, you agree that:

1. **Developer Certificate of Origin.** You have the right to submit your contribution under the
   project licence, as described by the [Developer Certificate of Origin 1.1](https://developercertificate.org/).
   You certify this by adding a `Signed-off-by` line to each commit (`git commit -s`).
2. **Relicensing grant.** You license your contribution to the project maintainer under the AGPL-3.0-or-later
   _and_ grant the maintainer a perpetual, worldwide, non-exclusive, royalty-free right to distribute your
   contribution under other licence terms as well. This keeps the option of offering ORBI under a dual
   licence later (for example, for a hosted service). Your contribution always remains available under the AGPL.

If you can't agree to point 2, say so in your pull request before it's merged.
