# AI Agent Instructions

Lightweight engineering mandates for AI agents working on Portfolio Tracker. For workspace architecture, developer setup, full CLI commands, and coverage details, follow [CONTRIBUTING.md](CONTRIBUTING.md), [CONCEPTS.md](CONCEPTS.md), and [docs/README.md](docs/README.md).

---

## 1. Core Financial, Tax & Generality Invariants

- **Invariant Oracle Law:** NEVER "fix" a test failure by modifying assertion values in `proptests.rs`, `tax_oracle_test.rs`, or `fixtures/golden_tax_vectors.json`, or by relaxing numerical tolerances (Units $\Delta \le 0.0001$, Money $\Delta \le ₹0.01$, Returns & XIRR $\Delta \le 10^{-6}$). Fix the implementation, never the oracle.
- **ITR Report Invariant Gate:** All ITR / capital gains changes must pass `verify_itr_invariants` (Table F quarterly symmetry, Section 55(2)(ac) grandfathering loss bounds, Budget 2024 rates 12.5% LTCG / 20% STCG post-July 23, 2024, non-negative exemptions).
- **Universal Generality Mandate:** NEVER introduce hacks, conditional branches, or hardcoded overrides tailored to a single portfolio, user, or statement. Generic overrides for broad provider/format quirks (e.g., CAMS vs. KFintech, AMC disclosures) are permitted only when structured uniformly across all portfolios.
- **Zero Real Data / Anti-PII:** NEVER hardcode, commit, stage, or log real PANs, names, emails, phone numbers, folios, bank/demat details, or CAS files (`*.cas.json`, `parsed_cas.json`). Use synthetic data only (e.g., `ABCDE1234F`, `ALPAC1001A`, "Aarav Sharma", "Neha Patel"), enforced by `scripts/check-privacy-and-pii.py`.
- **Mock Portfolio Suite:** All financial, consolidation, and UI changes MUST be validated against and baked into the 10+ synthetic mock portfolios (`mock_portfolios.rs`, `mock-portfolios.test.ts`, `mock-portfolios.spec.ts`) covering scheme consolidation, zero-holding isolation, partial redemptions, X-Ray/intersection, asset-class states, alternative assets, multi-member profiles, tax/grandfathering, ELSS 3-year lock-in, and folio lifecycle. Zero tolerance for `NaN` in UI.

## 2. Architecture, Static Guardrails & Code Quality

- **Zero-I/O Domain Engine:** `portfolio-core` MUST remain strictly synchronous and Zero-I/O with `#![forbid(unsafe_code)]`, enforced by `architecture_invariants_test.rs`.
- **View Layer Zero Business Logic:** Web (`frontend/src/components/`) and Mobile (`mobile/src/components/`, `mobile/app/`) must remain pure rendering layers, enforced by `scripts/check-view-layer-boundaries.py` (no statutory tax multiplications, Fisher compounding, tax/drag subtractions, direct DB imports, or calculation engine imports).
- **Zero-Any & Strict TypeScript:** Zero `any` in `frontend/src/` and `mobile/src/`. Enforce `tsconfig.app.json` (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`), `eslint-plugin-boundaries`, `eslint-plugin-check-file` (`PascalCase.tsx` components, `kebab-case.ts` utils), `frontend/src/env.ts` (`@t3-oss/env-core` + `zod`, no raw `import.meta.env`), and `knip --production` zero dead code.
- **Contract Parity:** All shared API contracts MUST use Rust-generated types (`frontend/src/types/generated/`, `mobile/src/types/generated/`). Re-export after any API struct change via `(cd backend-rs && cargo test --package portfolio-api --test export_bindings)` and verify `git diff --exit-code frontend/src/types/generated mobile/src/types/generated`.
- **Self-Documenting Code & Docs:** Use descriptive domain names (avoid cryptic abbreviations). Add Rust `///` doc comments, TypeScript `/** */` JSDoc, and explanatory comments on non-trivial math/statutory logic (FIFO, Section 55(2)(ac) grandfathering, XIRR fallbacks, look-through normalization, SQL CTEs).

## 3. Mandatory Specialist Subagents

- **`tax-statutory-auditor`:** MUST be consulted/invoked for any changes to tax logic, statutory rates, exemptions, Schedule CG ITR reports, or `backend-rs/crates/portfolio-core/src/tax/`. Audits against CBDT circulars / Finance Act rules and ensures `tax_oracle_test.rs`, `fixtures/golden_tax_vectors.json`, and `verify_itr_invariants` coverage.
- **Multi-Specialist Review Crew (Non-Trivial Features):** Before merging non-trivial features (changes touching domain/tax/API logic, UI flows, or >1 workspace), execute review via all 4 roles:
  1. `cx-frontend-auditor`: WCAG 2.1 AA keyboard/ARIA ergonomics, $375\text{px}$–$1440\text{px}$ responsiveness, visual clutter/clipping, layout memoization.
  2. `finance-visual-auditor`: Value Conservation Law ($\Delta \le ₹0.01$), sum-of-parts completeness, denominator clarity (`% of Portfolio` vs. `Asset Class` vs. `Parent`), arbitrage/hedging segregation.
  3. `code-quality-auditor`: Zero-Any, `exactOptionalPropertyTypes`, `eslint-plugin-boundaries`, `knip`, self-documenting code, and generality check.
  4. `mobile-offline-auditor`: $< 100$ms SQLite cold startup, mobile maintainability caps, Rust contract parity, `expo-secure-store` hardware storage.

## 4. Verification, Inner Dev Loop & Native Mobile Gates

- **Hermetic Verification & UAT:** Before committing or opening a PR, run and pass the full 12-stage hermetic verification sequence and blocking coverage gates documented in [CONTRIBUTING.md](CONTRIBUTING.md#testing-coverage--verification-sequence) (`check-privacy-and-pii.py`, `check-view-layer-boundaries.py`, `backend-rs/scripts/verify.sh`, `export_bindings`, `portfolio-parity`, `frontend build` & `test:unit`, `mobile build:verify` & `test:e2e`, `pnpm test:coverage`). Non-trivial PRs MUST also pass `pnpm run test:uat` (`scripts/run-uat-suite.sh`) and include passing evidence in the PR description.
- **Test Updates Committed With Code:** Always update and run hermetic unit tests, Web Playwright E2E (`pnpm --filter frontend test:e2e`), and Mobile simulation E2E (`pnpm --filter mobile test:e2e`) in the same change.
- **Autonomous Inner Dev Loop & Multimodal Visual Check:** Never mark UI/mobile/full-stack changes complete from static checks alone. Capture rendered screenshots (Playwright on Web; `adb exec-out screencap -p` or Maestro on Android/iOS) and perform multimodal visual inspection (layout, padding, safe areas, typography, contrast, clipping), iterating up to 5 self-correction passes until clean.
- **Strict Anti-Web-Mock Mandate for Mobile:** NEVER verify mobile features in a browser (`localhost:8082`). Mobile changes MUST be compiled and verified on genuine native binaries on both **Android** (`bash mobile/scripts/emulate-android.sh` / `Medium_Phone_API_37.0`) and **iOS** (`bash mobile/scripts/emulate-ios.sh` / `iPhone 17 Pro`), with Maestro flows under `mobile/e2e/flows/` registered in `mobile/scripts/run-native-e2e.sh`.
- **Mobile Gesture, Chart & Maintainability Invariants:**
  - `PanResponder` inside `<ScrollView>` MUST set `onPanResponderTerminationRequest: () => false`, `onShouldBlockNativeResponder: () => true`, bind `scrollEnabled={!chartGestureActive}` on `<ScrollView testID="dashboard-scroll">`, use a 150ms multi-touch cooldown debounce, and defer locking via `provisionalProbe`.
  - Time-domain zoom MUST enforce a 7-day floor (`MIN_WINDOW_MS`) with bracketing neighbors; pinned HUDs resolve from the full dataset, clamp off-screen coordinates, and show `(Off-screen ◀)` / `(Off-screen ▶)`.
  - Mobile files MUST satisfy: file $\le 300$ lines, function $\le 50$ lines, params $\le 3$ (zero `eslint-disable max-params`), cyclomatic complexity $\le 10$, zero `any`.
- **Git Push Discipline:** NEVER use `git push --no-verify`.

## 5. Key References

- **Developer Setup, Guardrails & Verification Commands:** [CONTRIBUTING.md](CONTRIBUTING.md)
- **Domain Glossary:** [CONCEPTS.md](CONCEPTS.md)
- **Architecture, Domain Internals, Plans, Specs & SOPs:** [docs/README.md](docs/README.md)
- **Documented Solutions:** [docs/solutions/](docs/solutions/)
- **Test Catalogs:** [Backend](backend-rs/crates/portfolio-core/tests/README.md) · [Frontend](frontend/tests/README.md) · [Mobile](mobile/README.md)
