# `@orbi/eslint-config`

Shared ESLint flat configs: `base`, `node` (packages, server), `react` (mobile), `next-js` (web).

Uses `@babel/eslint-parser` instead of typescript-eslint because TypeScript 7 has no programmatic API yet (see docs/technical-decisions.md TD-02). Type safety is enforced by `check-types`.
