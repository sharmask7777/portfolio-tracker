# Design Specification: Frontend Build-Time Guardrails & pnpm Migration (Issue #20)

**Issue:** [#20: Hard build time guardrails for react + ts + vite set up](https://github.com/sharmask7777/portfolio-tracker/issues/20)  
**Date:** 2026-11-02  
**Status:** DRAFT (Awaiting Review & Approval)

---

## 1. Intent & The "Why"

To protect the React + Vite + TypeScript frontend against runtime exceptions, architectural erosion, dead code accumulation, unchecked environment variable access, and type drift in an agentic coding environment. This mirrors the hard build-time guardrails established for the Rust backend (`backend-rs`), establishing a comprehensive static verification sequence where invalid code, broken imports, unverified environment variables, or loose typing fail loudly at build time.

Along with these guardrails, the workspace is migrating from `npm` to `pnpm` for faster, deterministic, symlink-isolated dependency management.

---

## 2. Goals, Non-Goals, and Anti-Goals

### Goals
- **Strict TypeScript Configuration**: Enforce `strict`, `noImplicitAny`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitReturns`, `noFallthroughCasesInSwitch`, `isolatedModules`, and `noEmit` across `frontend/tsconfig.json` and `frontend/tsconfig.app.json`.
- **Architectural Boundary Enforcement (`eslint-plugin-boundaries`)**: Enforce clean layer boundaries within `frontend/src/` (e.g., `components` cannot access internal private states of sibling modules; `components` can consume `types` and `utils`; utility modules cannot import UI components).
- **File Naming Conventions (`eslint-plugin-check-file`)**: Enforce PascalCase for React component files (`.tsx`) under `src/components/` and kebab-case for utility modules under `src/utils/` and `src/lib/`.
- **Strict React Hooks Rules**: Enforce `react-hooks/rules-of-hooks` and `react-hooks/exhaustive-deps` as `"error"`.
- **Type-Safe Schema-Validated Environment Variables (`@t3-oss/env-core` + `zod`)**: Centralize all `import.meta.env` access in `frontend/src/env.ts` with strict Zod validation schema (e.g., `VITE_API_URL`, `MODE`, `PROD`, `DEV`).
- **Dead Code & Dependency Sweeper (`knip`)**: Automate detection of unused files, exports, and dependencies via `knip.json` or `knip.config.ts`.
- **Build Scripts & Verification Gate**: Introduce `build:verify` (`pnpm lint && pnpm typecheck && pnpm knip`) gating `pnpm build`.
- **pnpm Migration**: Migrate root and `frontend/` packages from `npm` to `pnpm` (generating `pnpm-lock.yaml`, updating `.github/workflows/e2e.yml`, `.husky/pre-push`, `docker-compose.yml`, and `Dockerfile`s).
- **Documentation**: Update `AGENTS.md`, `README.md`, and test catalogs detailing the static guardrails paradigm.

### Non-Goals
- Altering existing UI component visual layouts or business calculation logic.
- Rewriting the backend API contracts or Rust domain engines.

### Anti-Goals
- Introducing `any` type casts to bypass strict TypeScript checks (violating the Zero-Any Mandate).
- Using `// @ts-ignore` or `eslint-disable` workarounds to silence architectural boundary or lint rules.
- Introducing portfolio-specific or single-user overrides.

---

## 3. Constraints & Invariants

- **The Zero-Any Mandate**: Zero `any` types permitted in `frontend/src/`. All API contracts must strictly use types generated from `backend-rs` (`frontend/src/types/generated/`).
- **The Invariant Oracle Law**: Numerical precision bounds and property test assertions must remain strictly unrelaxed.
- **Universal Generality Mandate**: All lint rules, boundaries, and environment validation schemas must be universally applicable across all portfolios and deployment configurations.
- **Coverage Gates**: All frontend test coverage gates (Lines $\ge 88\%$, Statements $\ge 86\%$, Funcs $\ge 85\%$, Branches $\ge 65\%$) must remain satisfied with 100% test pass rate.

---

## 4. Architectural & Implementation Decisions

### 4.1 Package Manager Migration (`pnpm`)
- Install `pnpm` dependencies for root and `frontend/`.
- Create `pnpm-workspace.yaml` specifying `frontend` workspace package.
- Remove legacy `package-lock.json` files and generate clean `pnpm-lock.yaml`.
- Update CI workflow `.github/workflows/e2e.yml` to use `pnpm/action-setup@v4`.
- Update `.husky/pre-push` to run commands with `pnpm`.
- Update `Dockerfile` in `frontend/` to use `pnpm` for building the production artifacts if applicable.

### 4.2 TypeScript Strictness (`frontend/tsconfig.app.json`)
Add the following strict flags to `compilerOptions`:
```json
{
  "strict": true,
  "noImplicitAny": true,
  "noUncheckedIndexedAccess": true,
  "exactOptionalPropertyTypes": true,
  "noImplicitReturns": true,
  "noFallthroughCasesInSwitch": true,
  "isolatedModules": true,
  "noEmit": true
}
```
Any indexed accesses (e.g. `array[i]`) will now have type `T | undefined`, requiring safe optional chaining or null-coalescing.

### 4.3 ESLint Flat Config (`frontend/eslint.config.js`)
Install as devDependencies:
- `eslint-plugin-boundaries`
- `eslint-plugin-check-file`
- `@t3-oss/env-core`
- `zod`
- `knip`

Configure ESLint rules:
1. `boundaries/element-types`:
   - Categorize elements: `components`, `utils`, `types`, `contexts`.
   - Component subdomains: `Analytics`, `Tax`, `Dashboard`, `Family`, `Auth`, `Insights`.
   - Prevent cross-domain private access between component subdomains (e.g., `Tax` cannot import private internals of `Analytics`).
   - Disallow circular dependencies.
   - Disallow `utils` from importing `components`.
2. `check-file/filename-naming-convention`:
   - `src/components/**/*.{tsx}`: `PASCAL_CASE` (with ignore pattern for `index.tsx` / `index.ts`).
   - `src/utils/**/*.{ts}`: `KEBAB_CASE` (with ignore pattern for `*.test.ts`).
3. `react-hooks`:
   - `"react-hooks/rules-of-hooks": "error"`
   - `"react-hooks/exhaustive-deps": "error"`

### 4.4 Schema-Validated Environment Variables (`frontend/src/env.ts`)
Using `@t3-oss/env-core` and `zod`:
```typescript
import { createEnv } from '@t3-oss/env-core';
import { z } from 'zod';

export const env = createEnv({
  clientPrefix: 'VITE_',
  client: {
    // Allows empty string, relative URLs (for production Nginx reverse proxy), or absolute URLs
    VITE_API_URL: z.string().optional(),
  },
  shared: {
    MODE: z.string().optional(),
    DEV: z.boolean().optional(),
    PROD: z.boolean().optional(),
  },
  runtimeEnv: import.meta.env,
  emptyStringAsUndefined: true,
});
```
Refactor `src/api.ts` and `src/config.ts` to consume `env.VITE_API_URL` and `env.PROD` instead of raw `import.meta.env`.

### 4.5 Dead Code Auditing (`frontend/knip.json`)
Configure Knip for Vite React SPA while respecting repo invariants:
```json
{
  "$schema": "https://unpkg.com/knip@5/overview/configuration-schema.json",
  "entry": [
    "src/main.tsx!",
    "src/test/setup.ts"
  ],
  "project": [
    "src/**/*.{ts,tsx}!"
  ],
  "ignore": [
    "src/types/generated/**"
  ],
  "ignoreDependencies": [
    "@vitest/ui",
    "@testing-library/jest-dom",
    "@axe-core/playwright"
  ]
}
```
*Rationale for `ignore: ["src/types/generated/**"]`:* `frontend/src/types/generated/` is code-generated from the Rust backend for cross-stack type synchronization. Only a subset of types are consumed directly by the UI today, but all types must remain present to satisfy the Zero-Any Mandate and the hermetic CI contract parity check (`cargo test --test export_bindings && git diff --exit-code`).

### 4.6 Verification & Build Pipeline
`frontend/package.json`:
- `"typecheck": "tsc --noEmit"`
- `"knip": "knip --production"`
- `"lint": "eslint ."`
- `"build:verify": "pnpm lint && pnpm typecheck && pnpm knip"`
- `"build": "pnpm build:verify && vite build"`

Root `package.json`:
- Update `scripts` to use `pnpm` throughout.

---

## 5. Verification Plan

1. `pnpm install` across root and `frontend`.
2. `(cd frontend && pnpm build:verify)` passes cleanly with 0 lint errors, 0 type errors, and 0 dead code warnings.
3. `(cd frontend && pnpm build && pnpm test:unit)` passes with 100% test success and meets all coverage thresholds.
4. `(cd backend-rs && ./scripts/verify.sh)` passes all 8 stages.
5. Pre-push hook passes with complete Docker E2E test execution.
6. Documentation updated in `AGENTS.md` and `README.md`.
