# Design Specification: Agent-Native Codebase Stabilization, Invariant Oracles & Tax Specialist Governance

**Date:** 2026-10-25  
**Status:** Approved Specification  
**Target Repository:** `portfolio-tracker` (`backend-rs`, `frontend`, `.husky`, `AGENTS.md`)

---

## 1. Intent and Problem Statement

Autonomous AI coding agents frequently introduce subtle calculation regressions and UI crashes in financial applications for three core structural reasons:
1. **Agents Grade Their Own Homework:** When given free rein over tests, agents write example-based tests that merely affirm whatever flawed logic their code produced, or they modify hardcoded assertion values to make tests pass.
2. **Permissive Compiler & Loose Typings:** In the frontend, missing TypeScript strictness (`strict: false`) and ubiquitous `any` typings allow schema drift between Rust backend DTOs and React components to go undetected until runtime, causing unhandled JavaScript crashes (`Cannot read properties of undefined`, `toFixed is not a function`).
3. **Flaky & Race-Prone Test Harnesses:** Blind `sleep` commands in test runners and short action timeouts cause non-deterministic failures in CI and pre-push hooks, leading agents to hallucinate bugs or get trapped in circular fix loops.

This project transforms the repository into an **Agent-Native Architecture** where correctness is enforced at the compiler and property-oracle level, and `AGENTS.md` provides explicit operational rules so any arbitrary agent can build stably without human hand-holding.

---

## 2. Goals, Non-Goals, and Anti-Goals

### Goals
- **End-to-End Contract Generation:** Automatically generate TypeScript type definitions from Rust backend API models (`ts-rs`), eliminating manual DTO duplication and schema drift.
- **Strict Frontend Boundary:** Enable `strict: true`, `noImplicitAny`, and `strictNullChecks` in `frontend/tsconfig.app.json`, refactoring loose `any` types in components (such as `SimulationModal.tsx` and `TaxView.tsx`) to strongly-typed contracts.
- **Dedicated Tax Rules Invariant Oracle:** Build a dedicated tax property oracle that continuously validates statutory Indian Income Tax Act rules (Section 112A, 111A, 50AA, 55(2)(ac) grandfathering, surcharge/cess, and loss set-offs).
- **ITR Report Invariant Gate:** Enforce that ITR-2 / Schedule CG report generators (both in `portfolio-core` and frontend `itrReportGenerator.ts`) execute invariant sanity checks and fail loudly before exporting if any tax invariant is breached.
- **Tax Specialist Agent Governance:** Define and configure a specialized subagent (`tax-statutory-auditor`) responsible for vetting tax statutory changes, maintaining tax rules, and preventing calculation drift.
- **Deterministic E2E Test Pipeline:** Replace blind `sleep 10` in `.husky/pre-push` with active HTTP/Docker service healthcheck polling, add browser console error capture in Playwright tests, and calibrate timeouts to eliminate false-positive flakes.
- **Agent Governance in `AGENTS.md`:** Codify clear, non-negotiable rules for agents: prohibiting assertion-relaxation, enforcing invariant-first development, and mandating hermetic verification before completion.

### Non-Goals
- Altering existing statutory tax formulas (Budget 2024 statutory rates remain 12.5% LTCG, 20% STCG, ₹1.25L exemption, etc.).
- Migrating the frontend away from React/Vite.
- Adding heavyweight runtime reflection libraries that degrade sub-millisecond calculation speed.

### Anti-Goals
- Over-coupling `portfolio-core` to database or network: the zero-I/O invariant of `portfolio-core` must remain 100% intact.
- Permitting agents to mock away or alter property oracles or golden fixtures during feature work.

---

## 3. Constraints & Architectural Decisions

- **Zero-I/O in `portfolio-core`:** Pure domain calculation engine (strictly zero HTTP, DB, or async dependencies).
- **Zero Real Data Commitment:** All fixtures, tests, and mock portfolios must strictly use synthetic, fictitious data (synthetic PANs like `ALPAC1001A`, fictitious names).
- **Committed Generated TypeScript Types:** The generated types in `frontend/src/types/generated/` are committed to git so `frontend/Dockerfile` builds cleanly without a Rust toolchain in Alpine. A pre-push and CI check (`cargo test --test export_bindings && git diff --exit-code frontend/src/types/generated`) prevents schema drift.
- **Advance Tax Accrual Matrix Mapping:** Invariant testing verifies that the sum of all 6 internal accrual buckets (`Q1`, `Q2A`, `Q2B`, `Q3`, `Q4`, `Q5`) strictly equals the total annual capital gains, and $Q2A + Q2B$ matches statutory Q2.
- **Golden Tax Vectors Authorship:** Golden tax vectors (`golden_tax_vectors.json`) are synthesized directly from verified Income Tax Act statutory provisions and the hermetic 10-portfolio mock suite (`mock_portfolios.rs`).

---

## 4. The Five Pillars of the Architecture

### Pillar 1: End-to-End Contract Generation & Strict Frontend Boundary

#### 1.1 Automated Rust-to-TypeScript Contract Export (`ts-rs`)
Add `ts-rs` to `backend-rs/Cargo.toml` as a workspace dependency. Annotate public API DTOs in `portfolio-api` and domain types in `portfolio-core` with `#[derive(TS)]` and `#[ts(export, export_to = ".../frontend/src/types/generated/")]`.
- **Target generated file:** `frontend/src/types/generated/api.d.ts` (or individual type files).
- **Cargo export test:** A dedicated test `cargo test --test export_bindings` that writes and updates these bindings.

#### 1.2 Frontend Strictness Hardening
Update `frontend/tsconfig.app.json`:
```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noImplicitThis": true,
    "alwaysStrict": true
  }
}
```
Refactor components with `any` parameters:
- `SimulationModal.tsx`: Replace `folio: any` and `result: any` with strongly-typed `FolioView` and `SimulationSellResponse`.
- `TaxView.tsx`: Replace un-typed lots and harvesting objects with explicit types.
- Ensure all property accesses (e.g., `tx.type?.toLowerCase()`, `e.unitsToHarvest?.toFixed()`) are guarded by optional chaining or default fallbacks.

#### 1.3 React Global Error Boundaries
Wrap critical views (`SimulationModal`, `TaxView`, `AnalyticsView`) in React Error Boundaries that log stack traces cleanly to the console (which Playwright listens to) rather than rendering a silent blank page.

---

### Pillar 2: Dedicated Tax Invariant Oracle & ITR Report Guard

#### 2.1 Dedicated Tax Rules Invariant Oracle (`tax_oracle.rs`)
Implement an isolated, property-based tax oracle in `portfolio-core/tests/tax_oracle_test.rs` asserting:
1. **Rate & Cutoff Conformance:**
   - Any transaction redeemed on or after 2024-07-23 must strictly use 12.5% LTCG and 20% STCG.
   - Any transaction redeemed before 2024-07-23 must strictly use 10% LTCG and 15% STCG.
   - Specified debt mutual funds purchased on or after 2023-04-01 are taxed as STCG at slab rates regardless of holding period.
2. **Deemed Cost & Grandfathering Bounds:**
   - For all purchases prior to 2018-01-31: $\text{Deemed Cost} = \max(\text{Actual Cost}, \min(\text{FMV 2018-01-31}, \text{Sale Price}))$.
   - Grandfathering deemed cost can never amplify or create a loss.
3. **Loss Set-Off Symmetry:**
   - Long-term capital losses can only offset long-term capital gains.
   - Short-term capital losses can offset both short-term and long-term capital gains.
   - Total taxable gain after loss set-off cannot be negative.
4. **Advance Tax Period Conservation:**
   - $\sum_{i=1}^{5} \text{PeriodGain}_i \equiv \text{TotalNetRealizedGain}_{\text{FY}}$.

#### 2.2 ITR Report Invariant Gate
Add an invariant verification guard to both the Rust ITR reporting engine and `frontend/src/utils/itrReportGenerator.ts`:
- Before producing Schedule CG and Schedule 112A rows, execute `verify_itr_invariants(report)`:
  - Asserts that sum of quarterly accrued gains equals total Schedule CG net capital gains.
  - Asserts that deemed cost for grandfathered records matches Section 55(2)(ac) constraints.
  - If any invariant is violated, throws a descriptive error and aborts export instead of generating an illegal tax filing.

#### 2.3 Immutable Golden Tax Vectors (`golden_tax_vectors.json`)
Create `backend-rs/crates/portfolio-core/tests/fixtures/golden_tax_vectors.json`:
- Contains 25+ hermetic test vectors covering every combination of debt/equity/hybrid, pre/post-Budget 2024, pre/post-2018 grandfathering, and multi-year loss carry-forward.
- Unit tests validate against this golden file. Agents are forbidden from altering expected outputs.

---

### Pillar 3: Deterministic, Flake-Free Test Harnesses

#### 3.1 Docker Stack Readiness Polling
In `.husky/pre-push` and test scripts, replace `sleep 10` with active HTTP/Docker service healthcheck polling:
```bash
echo "⏳ Waiting for backend API to be healthy..."
timeout=45
while ! curl -s -f http://127.0.0.1:8082/api/health > /dev/null 2>&1; do
  sleep 1
  timeout=$((timeout - 1))
  if [ $timeout -le 0 ]; then
    echo "❌ Backend failed to become healthy within 45s"
    docker compose logs
    exit 1
  fi
done
echo "✅ Backend API is ready."
```

#### 3.2 Playwright Timeout & Console Crash Detection
In `frontend/playwright.config.ts`:
- Adjust `actionTimeout` to a resilient 10,000ms.
- In `frontend/tests/utils/test-setup.ts`, attach a console listener:
```typescript
page.on('pageerror', (exception) => {
  throw new Error(`Unhandled browser exception: ${exception.message}\n${exception.stack}`);
});
```

---

### Pillar 4: Tax Specialist Agent & Governance Roles

#### 4.1 Specialized Subagent: `tax-statutory-auditor`
Define a specialized subagent in the Antigravity configuration:
- **Role:** Indian Income Tax Act Statutory Auditor.
- **Responsibilities:**
  - Audits any PR or change affecting `backend-rs/crates/portfolio-core/src/tax/`.
  - Verifies tax statutory parameters against official CBDT / Finance Act guidelines.
  - Ensures all new tax rules include corresponding property tests in `tax_oracle_test.rs`.

---

### Pillar 5: Agent Education & Codification in `AGENTS.md`

Update `AGENTS.md` with:
1. **The Invariant Oracle Law:** Agents must never "fix" test failures by altering assertions in property tests or golden parity fixtures.
2. **The Zero-Any Mandate:** No new `any` types allowed in TypeScript code. All API payloads must use types exported from `backend-rs`. `npm run build` (`tsc -b`) must pass cleanly.
3. **Hermetic Verification Sequence:** Every agent must run the local verification sequence before reporting success:
   1. `cargo test --workspace`
   2. `cargo clippy --workspace --all-targets -- -D warnings`
   3. `cd frontend && npm run build && npm run test:unit`
   4. `cargo run --package portfolio-parity`
4. **ITR Invariant Gate Enforcement:** Mandate that all ITR report modifications pass the invariant gate.

---

## 6. What is Left to the Builder

- The exact naming and module structure for the generated TypeScript files (`frontend/src/types/generated/`).
- Specific refactoring steps for secondary components (`Auth`, `Family`) once primary critical components (`SimulationModal`, `TaxView`) are typed.
- Precise tuning of the healthcheck poll count based on machine specs.
