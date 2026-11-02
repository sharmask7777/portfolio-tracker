# Frontend Build-Time Guardrails & pnpm Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish hard, build-time static guardrails for the React + Vite + TypeScript frontend (compiler strictness, architectural boundaries, file naming, React hooks, validated env variables, and dead code sweeping) while migrating the workspace from `npm` to `pnpm`.

**Architecture:** Monorepo root configured with `pnpm-workspace.yaml` managing `frontend`. Strict TypeScript configuration (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`) catches undefined indexing. ESLint flat config enforces unidirectional architecture and naming rules. `@t3-oss/env-core` + `zod` validates environment variables, and `knip` automates dead code sweeps without compromising Rust contract parity.

**Tech Stack:** `pnpm@12`, TypeScript 5/6, ESLint 9/10 (flat config), `eslint-plugin-boundaries`, `eslint-plugin-check-file`, `@t3-oss/env-core`, `zod`, `knip`, Vite, Vitest.

**Spec:** [`docs/superpowers/specs/2026-11-02-frontend-build-time-guardrails-and-pnpm-design.md`](file:///Users/shaleensharma/workplace/gemini_ws/portfolio-tracker/docs/superpowers/specs/2026-11-02-frontend-build-time-guardrails-and-pnpm-design.md)

## Global Constraints

- **The Invariant Oracle Law**: Numerical bounds (Units $\Delta \le 0.0001$, Money $\Delta \le ₹0.01$, Returns & XIRR $\Delta \le 10^{-6}$) and assertion values in tests must never be relaxed.
- **The Zero-Any Mandate**: No `any` types permitted in `frontend/src/`. All API contracts must strictly use generated TypeScript types from `backend-rs` (`frontend/src/types/generated/`).
- **Contract Drift Gate**: `cargo test --package portfolio-api --test export_bindings && git diff --exit-code frontend/src/types/generated` must pass with zero drift.
- **Knip Preservation Invariant**: `frontend/src/types/generated/**` must remain intact; Knip must not delete or flag unconsumed Rust contracts as dead code.
- **Coverage Gates**: Vitest coverage must remain above thresholds: Lines $\ge 88\%$, Statements $\ge 86\%$, Funcs $\ge 85\%$, Branches $\ge 65\%$.
- **Universal Generality Mandate**: Zero portfolio-specific hacks or overrides.

## Review Focus

1. **`noUncheckedIndexedAccess` Optionality**: Accessing `array[0]` now returns `T | undefined`. Implementers must safely handle potential `undefined` without unsafe `!` or `any` casts.
2. **Docker Monorepo Build Isolation**: `docker-compose.yml` and `frontend/Dockerfile` must copy `pnpm-workspace.yaml` and `pnpm-lock.yaml` cleanly from the root context without pulling in ignored host build artifacts.
3. **Environment Schema URLs**: `VITE_API_URL` must accept relative URLs (such as `""` or `"/api"`) used in production behind Nginx reverse proxy, not just absolute `http(s)://` URLs.
4. **Component Subdomain Boundaries**: Feature/subdomain components (e.g. `Tax`, `Analytics`, `Dashboard`, `Family`, `Auth`, `Insights`) must not reach into each other's private internals; all utility functions must remain strictly under `src/utils/`.
5. **CI & Pre-push Hook Parity**: The verification pipeline in `.husky/pre-push` and `.github/workflows/e2e.yml` must use `pnpm` consistently across all steps.

---

### Task 1: pnpm Workspace Migration & Docker/CI Alignment

**Files:**
- Create: `pnpm-workspace.yaml`
- Modify: `package.json`
- Modify: `frontend/package.json`
- Modify: `docker-compose.yml`
- Modify: `frontend/Dockerfile`
- Create/Modify: `.dockerignore`
- Modify: `.husky/pre-push`
- Modify: `.github/workflows/e2e.yml`
- Delete: `package-lock.json`, `frontend/package-lock.json`

**Interfaces:**
- Consumes: Existing npm scripts and dependencies
- Produces: Clean root `pnpm-lock.yaml`, unified workspace scripts (`pnpm dev`, `pnpm build`, `pnpm test`, etc.)

- [ ] **Step 1: Create `pnpm-workspace.yaml` at root**
  ```yaml
  packages:
    - 'frontend'
  ```

- [ ] **Step 2: Generate `pnpm-lock.yaml` and remove npm lockfiles**
  - Run: `pnpm install`
  - Remove `package-lock.json` and `frontend/package-lock.json`.
  - Verify that `pnpm-lock.yaml` is created at the repository root.

- [ ] **Step 3: Update scripts in root `package.json` and `frontend/package.json`**
  - In root `package.json`: replace `npm run ... --prefix frontend` with `pnpm --filter frontend ...`.
  - In `frontend/package.json`: ensure test and dev scripts use `pnpm`.

- [ ] **Step 4: Update `frontend/Dockerfile`, `docker-compose.yml`, and `.dockerignore`**
  - In `docker-compose.yml`:
    ```yaml
    frontend:
      build:
        context: .
        dockerfile: frontend/Dockerfile
    ```
  - In `frontend/Dockerfile`:
    - Enable pnpm (`RUN corepack enable || npm install -g pnpm`).
    - Copy `pnpm-lock.yaml`, `pnpm-workspace.yaml`, and `frontend/package.json`.
    - Run `pnpm install --frozen-lockfile --filter frontend...`.
    - Build frontend and serve via Nginx.
  - In `.dockerignore`: ensure `backend-rs/target`, `.git`, `node_modules` are excluded from the root context.

- [ ] **Step 5: Update `.husky/pre-push` and `.github/workflows/e2e.yml`**
  - In `.husky/pre-push`: replace `npm run ...` with `pnpm ...`.
  - In `.github/workflows/e2e.yml`: add `pnpm/action-setup@v4` step before `actions/setup-node`.

- [ ] **Step 6: Verify workspace installation and build**
  - Run: `pnpm install --frozen-lockfile`
  - Run: `pnpm --filter frontend build`
  - Expected: PASS with 0 errors.

- [ ] **Step 7: Commit**
  ```bash
  git add pnpm-workspace.yaml pnpm-lock.yaml package.json frontend/package.json docker-compose.yml frontend/Dockerfile .dockerignore .husky/pre-push .github/workflows/e2e.yml
  git rm package-lock.json frontend/package-lock.json
  git commit -m "feat(infra): migrate workspace from npm to pnpm with unified lockfile and docker context"
  ```

---

### Task 2: TypeScript Strictness Guardrails & Indexed Access Remediation

**Files:**
- Modify: `frontend/tsconfig.app.json`
- Modify: `frontend/package.json`
- Modify: `frontend/src/` (remediate any indexed-access type errors)

**Interfaces:**
- Consumes: Strict compiler options
- Produces: Type-safe indexing across all frontend source files

- [ ] **Step 1: Update `frontend/tsconfig.app.json`**
  Add strict flags to `compilerOptions`:
  ```json
  "noUncheckedIndexedAccess": true,
  "exactOptionalPropertyTypes": true,
  "noImplicitReturns": true,
  "isolatedModules": true
  ```

- [ ] **Step 2: Add `typecheck` script to `frontend/package.json`**
  ```json
  "typecheck": "tsc -b --noEmit"
  ```

- [ ] **Step 3: Run `pnpm --filter frontend typecheck` to identify violations**
  - Run: `pnpm --filter frontend typecheck`
  - Expected: Lists places where array indexing or optional properties require null/undefined guarding.

- [ ] **Step 4: Remediate any flagged violations in `frontend/src/`**
  - Safely guard array lookups (e.g. `const item = items[0]; if (!item) return;` or optional chaining `items[0]?.field`).
  - Do NOT use `any` or `!` assertion shortcuts.

- [ ] **Step 5: Verify clean typecheck**
  - Run: `pnpm --filter frontend typecheck`
  - Expected: PASS with 0 type errors.

- [ ] **Step 6: Verify tests pass**
  - Run: `pnpm --filter frontend test:unit`
  - Expected: 100% tests pass and coverage gates met.

- [ ] **Step 7: Commit**
  ```bash
  git add frontend/tsconfig.app.json frontend/package.json frontend/src
  git commit -m "feat(types): enforce strict typescript compiler guardrails with noUncheckedIndexedAccess"
  ```

---

### Task 3: ESLint Architectural Boundaries, File Conventions & React Hooks

**Files:**
- Modify: `frontend/package.json`
- Modify: `frontend/eslint.config.js`

**Interfaces:**
- Consumes: ESLint flat config
- Produces: Architectural boundary enforcement and file naming validation

- [ ] **Step 1: Install `eslint-plugin-boundaries` and `eslint-plugin-check-file`**
  - Run: `pnpm --filter frontend add -D eslint-plugin-boundaries eslint-plugin-check-file`

- [ ] **Step 2: Configure architectural boundaries in `frontend/eslint.config.js`**
  - Configure `boundaries/element-types`:
    - Elements: `components`, `utils`, `types`, `contexts`.
    - Component subdomains: `Analytics`, `Tax`, `Dashboard`, `Family`, `Auth`, `Insights`.
    - Prohibit circular dependencies.
    - Prohibit `utils` from importing `components`.
    - Prohibit cross-domain internal imports between component subdomains.

- [ ] **Step 3: Configure file naming rules in `frontend/eslint.config.js`**
  - `src/components/**/*.{tsx}`: `PASCAL_CASE` (ignore `index.tsx`, `index.ts`, `*.test.tsx`).
  - `src/utils/**/*.{ts}`: `KEBAB_CASE` (ignore `*.test.ts`).

- [ ] **Step 4: Set React Hooks rules to `"error"`**
  - `"react-hooks/rules-of-hooks": "error"`
  - `"react-hooks/exhaustive-deps": "error"`

- [ ] **Step 5: Run linter to verify rules**
  - Run: `pnpm --filter frontend lint`
  - If any files violate naming or boundaries, fix them.

- [ ] **Step 6: Commit**
  ```bash
  git add frontend/package.json frontend/eslint.config.js pnpm-lock.yaml
  git commit -m "feat(lint): enforce architectural boundaries, file naming, and strict react hooks rules"
  ```

---

### Task 4: Schema-Validated Environment Variables (`@t3-oss/env-core` & `zod`)

**Files:**
- Modify: `frontend/package.json`
- Create: `frontend/src/env.ts`
- Modify: `frontend/src/api.ts`
- Modify: `frontend/src/config.ts`
- Create: `frontend/src/env.test.ts`

**Interfaces:**
- Consumes: `import.meta.env`
- Produces: Validated, typed `env` object exported from `src/env.ts`

- [ ] **Step 1: Install `@t3-oss/env-core` and `zod`**
  - Run: `pnpm --filter frontend add @t3-oss/env-core zod`

- [ ] **Step 2: Create unit test `frontend/src/env.test.ts`**
  ```typescript
  import { describe, it, expect } from 'vitest';
  import { env } from './env';

  describe('env configuration', () => {
    it('provides validated env object', () => {
      expect(env).toBeDefined();
      expect(typeof env.VITE_API_URL === 'string' || env.VITE_API_URL === undefined).toBe(true);
    });
  });
  ```

- [ ] **Step 3: Create `frontend/src/env.ts`**
  ```typescript
  import { createEnv } from '@t3-oss/env-core';
  import { z } from 'zod';

  export const env = createEnv({
    clientPrefix: 'VITE_',
    client: {
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

- [ ] **Step 4: Refactor `src/api.ts` and `src/config.ts` to consume `env`**
  - Replace `import.meta.env.VITE_API_URL` with `env.VITE_API_URL`.
  - Replace `import.meta.env.PROD` with `env.PROD`.

- [ ] **Step 5: Run tests and typecheck**
  - Run: `pnpm --filter frontend typecheck && pnpm --filter frontend test:unit`
  - Expected: PASS.

- [ ] **Step 6: Commit**
  ```bash
  git add frontend/package.json frontend/src/env.ts frontend/src/env.test.ts frontend/src/api.ts frontend/src/config.ts pnpm-lock.yaml
  git commit -m "feat(env): introduce schema-validated environment variables via @t3-oss/env-core and zod"
  ```

---

### Task 5: Dead Code Auditing (`knip`) & Build Verification Pipeline

**Files:**
- Modify: `frontend/package.json`
- Create: `frontend/knip.json`

**Interfaces:**
- Consumes: Full source tree
- Produces: Clean dead-code report and `build:verify` script

- [ ] **Step 1: Install `knip`**
  - Run: `pnpm --filter frontend add -D knip`

- [ ] **Step 2: Configure `frontend/knip.json`**
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

- [ ] **Step 3: Update `frontend/package.json` scripts**
  ```json
  "knip": "knip --production",
  "build:verify": "pnpm lint && pnpm typecheck && pnpm knip",
  "build": "pnpm build:verify && vite build"
  ```

- [ ] **Step 4: Execute Knip and resolve any genuine dead code**
  - Run: `pnpm --filter frontend knip`
  - If any unused exports or dead files are detected, safely resolve them or configure specific ignore entries.

- [ ] **Step 5: Verify `build:verify` and `build`**
  - Run: `pnpm --filter frontend build:verify`
  - Run: `pnpm --filter frontend build`
  - Expected: PASS with 0 warnings/errors.

- [ ] **Step 6: Commit**
  ```bash
  git add frontend/package.json frontend/knip.json pnpm-lock.yaml
  git commit -m "feat(ci): add knip dead-code sweeper and configure build:verify pipeline"
  ```

---

### Task 6: Documentation Updates & Full Hermetic Certification

**Files:**
- Modify: `AGENTS.md`
- Modify: `README.md`
- Modify: `frontend/tests/README.md`

**Interfaces:**
- Consumes: All completed tooling and build changes
- Produces: Updated engineering guidelines reflecting the static guardrails paradigm

- [ ] **Step 1: Update `AGENTS.md`**
  - Update Section 2 ("The Zero-Any Mandate") and Section 4 ("Mandatory Hermetic Verification Sequence") to use `pnpm` throughout.
  - Document the frontend static guardrails: TypeScript strictness (`noUncheckedIndexedAccess`), architectural boundaries (`eslint-plugin-boundaries`), validated env (`src/env.ts`), dead-code sweeping (`knip`), and `pnpm build:verify`.

- [ ] **Step 2: Update `README.md`**
  - Update all development, installation, build, and test instructions to use `pnpm`.
  - Add a dedicated section describing the static build-time guardrails for both Rust backend and React frontend.

- [ ] **Step 3: Execute the full hermetic verification sequence**
  - Backend pipeline: `(cd backend-rs && ./scripts/verify.sh)`
  - Contract check: `(cd backend-rs && cargo test --package portfolio-api --test export_bindings) && git diff --exit-code frontend/src/types/generated`
  - Frontend verification: `pnpm --filter frontend build:verify`
  - Frontend tests: `pnpm --filter frontend test:unit`
  - Parity harness: `(cd backend-rs && cargo run --package portfolio-parity)`

- [ ] **Step 4: Commit**
  ```bash
  git add AGENTS.md README.md frontend/tests/README.md
  git commit -m "docs: document frontend static guardrails paradigm and update instructions for pnpm"
  ```
