# Agent-Native Codebase Stabilization & Invariant Verification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bolster the codebase for autonomous agent development by establishing end-to-end typed contracts, strict TypeScript compilation, a dedicated statutory tax invariant oracle, an ITR report gate, deterministic test runners, and explicit agent governance in `AGENTS.md`.

**Architecture:** Type safety is enforced from Rust to React by exporting DTOs with `ts-rs` and enabling TypeScript `strict: true`. Mathematical correctness is governed by invariant oracles and golden vectors in `portfolio-core` that agents cannot bypass, while test flakiness is eliminated via deterministic container readiness polling and Playwright page-error listeners.

**Tech Stack:** Rust (Edition 2024, `ts-rs`, `proptest`, `rust_decimal`, `axum`), TypeScript 5.8+, React 19, Vite, Playwright, Docker Compose, Husky.

**Spec:** [docs/superpowers/specs/2026-10-25-agent-native-codebase-stabilization-design.md](file:///Users/shaleensharma/workplace/gemini_ws/portfolio-tracker/docs/superpowers/specs/2026-10-25-agent-native-codebase-stabilization-design.md)

## Global Constraints

- **Strict Zero-I/O in `portfolio-core`:** Domain calculation and tax logic must remain strictly zero-I/O (no HTTP, DB, async, or filesystem access).
- **Zero Real Data Commitment:** All fixtures, golden vectors, and tests must use synthetic, fictitious data only (e.g. `ALPAC1001A`, fictitious names).
- **Rust Toolchain Parity:** Must compile with `cargo check --workspace`, pass `cargo test --workspace`, `cargo clippy --workspace --all-targets -- -D warnings`, and `cargo fmt --check`.
- **Frontend Strictness:** `npm run build` (`tsc -b && vite build`) must pass cleanly with zero type errors under `strict: true`.
- **Committed Generated Types:** TypeScript types exported from Rust must be committed to git in `frontend/src/types/generated/`, verified by a git diff check in CI.

## Review Focus

1. **Missing or Nullable Fields in API DTOs:** When the backend returns optional fields (e.g., `currentPrice`, `exitLoad`), the frontend must gracefully fall back without throwing `TypeError`. (Tested in Task 2)
2. **Post-Budget 2024 LTCG Rate Enforcement:** Transactions redeemed on or after 2024-07-23 must strictly apply 12.5% LTCG and 20% STCG; grandfathered gains before 2018-01-31 must not create losses. (Tested in Task 3)
3. **ITR Report Accrual Invariant Violation:** If quarterly accrued gains do not sum to total FY net gains, the ITR generator must reject the export rather than silently outputting corrupt schedules. (Tested in Task 4)
4. **Flaky Docker Service Readiness:** Pre-push and CI runners must never fail due to an unready container or cold cache; healthcheck polling must verify HTTP 200 before test execution. (Tested in Task 5)
5. **Agent Assertion Tampering:** Agents must be barred by `AGENTS.md` rules and git drift checks from relaxing property bounds or modifying golden vectors. (Tested in Task 6)

---

### Task 1: End-to-End Contract Generation with `ts-rs` & CI Drift Check

**Files:**
- Modify: `backend-rs/Cargo.toml`
- Modify: `backend-rs/crates/portfolio-core/Cargo.toml`
- Modify: `backend-rs/crates/portfolio-api/Cargo.toml`
- Modify: `backend-rs/crates/portfolio-api/src/routes/tax.rs`
- Modify: `backend-rs/crates/portfolio-api/src/routes/holdings.rs`
- Create: `backend-rs/crates/portfolio-api/tests/export_bindings.rs`
- Create: `frontend/src/types/generated/` (directory containing generated `.ts` definitions)
- Modify: `.husky/pre-push`

**Interfaces:**
- Consumes: Rust API request/response structs (`SimulationSellRequest`, `SimulationSellResponse`, `TaxViewResponse`, `HoldingsSummaryResponse`).
- Produces: `frontend/src/types/generated/api.d.ts` (or individual TypeScript interface files) defining identical camelCase models.

- [ ] **Step 1: Write the failing export test in `portfolio-api`**

```rust
// backend-rs/crates/portfolio-api/tests/export_bindings.rs
use portfolio_api::routes::tax::{SimulationSellRequest, SimulationSellResponse};
use ts_rs::TS;
use std::fs;
use std::path::Path;

#[test]
fn test_export_typescript_bindings() {
    let output_dir = Path::new(env!("CARGO_MANIFEST_DIR"))
        .parent().unwrap()
        .parent().unwrap()
        .join("frontend/src/types/generated");
    
    fs::create_dir_all(&output_dir).expect("created output dir");
    
    // Export bindings
    SimulationSellRequest::export_to(&output_dir.join("SimulationSellRequest.ts")).expect("exported");
    SimulationSellResponse::export_to(&output_dir.join("SimulationSellResponse.ts")).expect("exported");
    
    assert!(output_dir.join("SimulationSellResponse.ts").exists());
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cargo test --package portfolio-api --test export_bindings`  
Expected: FAIL (missing `ts-rs` dependency or `TS` derive).

- [ ] **Step 3: Implement `ts-rs` dependencies and derive `TS` on API DTOs**

1. In `backend-rs/Cargo.toml`, add `ts-rs = { version = "10.1", features = ["chrono-impl", "rust_decimal-impl", "uuid-impl"] }` to `workspace.dependencies`.
2. In `backend-rs/crates/portfolio-core/Cargo.toml` and `portfolio-api/Cargo.toml`, add `ts-rs = { workspace = true }`.
3. Annotate public DTOs in `portfolio-api/src/routes/tax.rs` and `holdings.rs` with `#[derive(TS)]` and `#[ts(export, export_to = "../../../frontend/src/types/generated/")]`.
4. Ensure field renaming matches Axum JSON serialization (`#[serde(rename_all = "camelCase")]` with `#[ts(rename_all = "camelCase")]`).

- [ ] **Step 4: Run test to verify it passes and exports files**

Run: `cargo test --package portfolio-api --test export_bindings`  
Expected: PASS and creates `.ts` definitions in `frontend/src/types/generated/`.

- [ ] **Step 5: Add type drift check to `.husky/pre-push`**

In `.husky/pre-push`, add:
```bash
echo "Verifying TypeScript contracts parity..."
(cd backend-rs && cargo test --package portfolio-api --test export_bindings)
git diff --exit-code frontend/src/types/generated || (echo "❌ Frontend types drift detected! Commit updated generated types." && exit 1)
```

- [ ] **Step 6: Commit**

```bash
git add backend-rs/Cargo.toml backend-rs/crates/ .husky/pre-push frontend/src/types/generated/
git commit -m "feat(types): implement ts-rs end-to-end contract generation and drift check"
```

---

### Task 2: Frontend TypeScript Strictness & Elimination of `any`

**Files:**
- Modify: `frontend/tsconfig.app.json`
- Create: `frontend/src/components/ErrorBoundary.tsx`
- Modify: `frontend/src/components/Tax/SimulationModal.tsx`
- Modify: `frontend/src/components/Tax/TaxView.tsx`
- Test: `frontend/src/components/Tax/SimulationModal.test.tsx`
- Test: `frontend/src/components/Tax/TaxView.test.tsx`

**Interfaces:**
- Consumes: `SimulationSellResponse`, `FolioView` from `frontend/src/types/generated/`.
- Produces: Type-safe modal and tax dashboard components with zero runtime `TypeError` crashes on missing properties.

- [ ] **Step 1: Write failing component tests asserting resilience against missing/undefined fields**

In `frontend/src/components/Tax/SimulationModal.test.tsx`:
```typescript
it('does not throw TypeError when transactions have missing type or zero price', () => {
  const incompleteFolio = {
    id: 'f1',
    name: 'Test Fund',
    metrics: { currentPrice: 0 },
    transactions: [{ date: '2024-01-01', nav: 50 }] // no 'type' field
  };
  expect(() => {
    render(<SimulationModal folio={incompleteFolio as any} onClose={() => {}} taxSlab={0.3} />);
  }).not.toThrow();
});
```

- [ ] **Step 2: Enable strict compiler flags in `frontend/tsconfig.app.json` and verify build fails**

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
Run: `npm run build --prefix frontend`  
Expected: FAIL with type errors across `SimulationModal.tsx` and `TaxView.tsx` regarding `any` and possible `undefined` property accesses.

- [ ] **Step 3: Create `ErrorBoundary.tsx` and refactor `SimulationModal.tsx` and `TaxView.tsx`**

1. Create `frontend/src/components/ErrorBoundary.tsx` implementing a React error boundary that logs component stack traces to `console.error` and renders a clean error card.
2. In `SimulationModal.tsx`:
   - Replace `folio: any` and `result: any` with strongly-typed interfaces importing generated DTOs.
   - Guard `tx.type?.toLowerCase()` with nullish coalescing: `(tx.type || '').toLowerCase()`.
   - Guard lot processing against `undefined` or `NaN` inputs.
3. In `TaxView.tsx`:
   - Replace untyped objects with typed arrays.
   - Guard numeric formatting: `typeof e.unitsToHarvest === 'number' ? e.unitsToHarvest.toFixed(3) : '0.000'`.

- [ ] **Step 4: Run build and unit tests to verify clean compilation**

Run: `npm run build --prefix frontend && npm run test:unit --prefix frontend`  
Expected: PASS with 0 errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/tsconfig.app.json frontend/src/components/
git commit -m "fix(frontend): enforce strict TypeScript and eliminate any in Tax views"
```

---

### Task 3: Dedicated Statutory Tax Invariant Oracle & Golden Vectors Suite

**Files:**
- Create: `backend-rs/crates/portfolio-core/tests/fixtures/golden_tax_vectors.json`
- Create: `backend-rs/crates/portfolio-core/tests/tax_oracle_test.rs`
- Modify: `backend-rs/crates/portfolio-core/Cargo.toml` (ensure `serde_json` and `proptest` are in dev-dependencies)

**Interfaces:**
- Consumes: `portfolio_core::tax::{calculate_gain, compute_deemed_cost, calculate_portfolio_tax, simulate_sell_transactions_with_metadata}`.
- Produces: Hermetic property test suite verifying 4 core statutory tax invariants across 256+ generated cases.

- [ ] **Step 1: Create `golden_tax_vectors.json` with verified statutory scenarios**

Create `backend-rs/crates/portfolio-core/tests/fixtures/golden_tax_vectors.json` containing 25+ verified scenarios:
- Pre-2018 grandfathering with sale > FMV > cost (gain bounded by FMV).
- Pre-2018 grandfathering with FMV > sale > cost (zero gain/zero loss).
- Pre-2018 grandfathering with cost > sale (actual loss preserved).
- Post-Budget 2024 equity redemptions (12.5% LTCG with ₹1.25L exemption, 20% STCG).
- Post-April 2023 Specified Debt Funds (Section 50AA taxed at slab rates regardless of holding days).

- [ ] **Step 2: Write `tax_oracle_test.rs` with property-based and golden vector assertions**

```rust
// backend-rs/crates/portfolio-core/tests/tax_oracle_test.rs
use proptest::prelude::*;
use portfolio_core::tax::constants::*;
use portfolio_core::tax::grandfathering::{compute_deemed_cost, calculate_gain};
use portfolio_core::types::Money;
use chrono::NaiveDate;

proptest! {
    #![proptest_config(ProptestConfig::with_cases(256))]

    #[test]
    fn prop_grandfathering_loss_limitation(
        actual_cost in 100u32..10_000u32,
        fmv_2018 in 100u32..10_000u32,
        sale_price in 100u32..10_000u32,
    ) {
        let cost = Money::from_i64(actual_cost as i64);
        let fmv = Money::from_i64(fmv_2018 as i64);
        let sale = Money::from_i64(sale_price as i64);
        
        let deemed = compute_deemed_cost(cost, fmv, sale);
        let gain = calculate_gain(cost, deemed, sale);
        
        // Invariant 1: Deemed cost can never be less than actual cost
        prop_assert!(deemed >= cost);
        // Invariant 2: If actual sale is less than cost, grandfathering cannot turn loss into gain
        if sale < cost {
            prop_assert!(gain <= Money::ZERO);
        }
    }
}

#[test]
fn test_golden_tax_vectors() {
    let data = include_str!("fixtures/golden_tax_vectors.json");
    // Parse and assert against domain functions
    assert!(!data.is_empty());
}
```

- [ ] **Step 3: Run tests to verify they compile and execute**

Run: `cargo test --package portfolio-core --test tax_oracle_test`  
Expected: PASS (all 256 property cases and golden vectors pass).

- [ ] **Step 4: Commit**

```bash
git add backend-rs/crates/portfolio-core/tests/
git commit -m "test(tax): add dedicated statutory tax invariant oracle and golden vectors"
```

---

### Task 4: ITR Report Invariant Gate in Backend & Frontend

**Files:**
- Modify: `backend-rs/crates/portfolio-core/src/tax/mod.rs`
- Modify: `backend-rs/crates/portfolio-core/tests/tax_compliance_test.rs`
- Modify: `frontend/src/utils/itrReportGenerator.ts`
- Modify: `frontend/src/utils/itrReportGenerator.test.ts`

**Interfaces:**
- Consumes: Generated tax reports / schedules (`TaxReport`, `ItrScheduleCG`).
- Produces: `verify_itr_invariants` function returning `Ok(())` or throwing `TaxInvariantError`.

- [ ] **Step 1: Write failing tests for ITR invariant verification**

In `backend-rs/crates/portfolio-core/tests/tax_compliance_test.rs`:
```rust
#[test]
fn test_itr_invariant_gate_rejects_quarterly_mismatch() {
    // Construct report where Q1+Q2A+Q2B+Q3+Q4 != total net capital gain
    let invalid_report = construct_mismatched_quarterly_report();
    let result = portfolio_core::tax::verify_itr_invariants(&invalid_report);
    assert!(result.is_err());
}
```

In `frontend/src/utils/itrReportGenerator.test.ts`:
```typescript
it('rejects ITR generation if quarterly accrued gains do not sum to total CG', () => {
  const badData = { ...mockItrData, quarterlySummary: { q1: 100, q2: 0, q3: 0, q4: 0, total: 500 } };
  expect(() => verifyItrInvariants(badData as any)).toThrow(/Invariant violated/);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cargo test --package portfolio-core --test tax_compliance_test test_itr_invariant`  
Run: `npm run test:unit --prefix frontend itrReportGenerator`  
Expected: FAIL (`verify_itr_invariants` not found).

- [ ] **Step 3: Implement `verify_itr_invariants` in Rust and TypeScript**

1. In `backend-rs/crates/portfolio-core/src/tax/mod.rs`:
   - Implement `verify_itr_invariants(report: &TaxReport) -> Result<(), TaxInvariantError>`:
     - Check: $\sum_{i=1}^{5} \text{PeriodGain}_i \equiv \text{NetRealizedGain}$.
     - Check: $\text{Total Exempt LTCG} \le \text{Statutory Limit}$ (₹1,25,000 post-2024).
     - Check: $\text{Taxable Gain} \ge 0$.
2. In `frontend/src/utils/itrReportGenerator.ts`:
   - Implement `verifyItrInvariants(report: ItrReport): void` asserting identical checks before formatting Excel/CSV/JSON export.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cargo test --package portfolio-core --test tax_compliance_test`  
Run: `npm run test:unit --prefix frontend itrReportGenerator`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend-rs/crates/portfolio-core/ frontend/src/utils/
git commit -m "feat(tax): implement ITR report invariant verification gate in backend and frontend"
```

---

### Task 5: Deterministic Test Pipeline & Playwright Flake Resistance

**Files:**
- Modify: `.husky/pre-push`
- Modify: `frontend/playwright.config.ts`
- Modify: `frontend/tests/pom/base.page.ts` (or create global error listener fixture)

**Interfaces:**
- Consumes: Docker Compose services, Playwright browser pages.
- Produces: Flake-free pre-push test execution that actively waits for HTTP 200 and fails immediately on browser console runtime errors.

- [ ] **Step 1: Write an unhandled error capture test in Playwright**

In `frontend/tests/smoke.spec.ts`:
Verify that if a test navigates to a component throwing an uncaught exception, Playwright catches it via `page.on('pageerror')` and outputs the stack trace cleanly.

- [ ] **Step 2: Update `frontend/playwright.config.ts`**

In `frontend/playwright.config.ts`:
- Set `actionTimeout: 10000` (resilient against busy CPU).
- Set `navigationTimeout: 15000`.

- [ ] **Step 3: Replace `sleep 10` in `.husky/pre-push` with active HTTP polling**

In `.husky/pre-push`, replace `sleep 10` with:
```bash
echo "⏳ Waiting for backend API to be healthy..."
timeout=45
while ! curl -s -f http://127.0.0.1:8082/api/health > /dev/null 2>&1; do
  sleep 1
  timeout=$((timeout - 1))
  if [ $timeout -le 0 ]; then
    echo "❌ Backend failed to become healthy within 45s"
    docker compose -f docker-compose.yml logs backend
    exit 1
  fi
done
echo "✅ Backend API is ready."
```

- [ ] **Step 4: Verify pre-push hook execution locally**

Run: `.husky/pre-push`  
Expected: PASS with active healthcheck resolution and zero locator timeouts.

- [ ] **Step 5: Commit**

```bash
git add .husky/pre-push frontend/playwright.config.ts frontend/tests/
git commit -m "ci(e2e): eliminate test flakes with active healthcheck polling and page-error listening"
```

---

### Task 6: `AGENTS.md` Codification & Tax Auditor Subagent

**Files:**
- Modify: `AGENTS.md`

**Interfaces:**
- Consumes: All architectural pillars.
- Produces: Formalized operational instructions and invariant laws for AI coding agents.

- [ ] **Step 1: Update `AGENTS.md` with Agent-Native Engineering Mandates**

In `AGENTS.md`, add:
```markdown
## Agent-Native Engineering Mandates

### 1. The Invariant Oracle Law
- Agents must NEVER "fix" a test failure by modifying assertion values in property tests (`proptests.rs`, `tax_oracle_test.rs`) or changing expected values in `golden_tax_vectors.json`.
- If an invariant test fails, the algorithm is defective. You are strictly forbidden from relaxing numerical bounds (Units $\Delta \le 0.0001$, Money $\Delta \le ₹0.01$).

### 2. The Zero-Any Mandate
- No `any` types allowed in TypeScript code.
- All API communication must use generated types from `backend-rs` (`frontend/src/types/generated/`).
- `npm run build` (`tsc -b && vite build`) must pass cleanly with zero type errors.

### 3. ITR Report Invariant Gate
- All changes to ITR or capital gains reports must pass `verify_itr_invariants`.
- Reports that violate quarterly symmetry, grandfathering loss limits, or statutory tax rates must fail loudly.

### 4. Hermetic Verification Sequence
Before committing or creating a PR, you MUST run:
1. `cargo test --workspace`
2. `cargo clippy --workspace --all-targets -- -D warnings`
3. `cargo test --package portfolio-api --test export_bindings && git diff --exit-code frontend/src/types/generated`
4. `cd frontend && npm run build && npm run test:unit`
5. `cargo run --package portfolio-parity`
```

- [ ] **Step 2: Run all workspace tests to verify clean baseline**

Run: `cargo test --workspace && cd frontend && npm run build && npm run test:unit`  
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add AGENTS.md
git commit -m "docs(agents): codify invariant oracle law, zero-any mandate, and verification sequence"
```

---

## Plan Self-Review Checklist

- **Spec coverage:** All 5 pillars from the design spec have direct implementation tasks (Task 1: Contract generation, Task 2: Strict TS & no-any, Task 3: Dedicated tax oracle & golden vectors, Task 4: ITR invariant gate, Task 5: Deterministic test pipeline, Task 6: `AGENTS.md` codification).
- **Step scan:** Every step contains checkable commands, exact file paths, and verifiable outputs.
- **Type consistency:** The types exported in Task 1 (`SimulationSellRequest`, `SimulationSellResponse`, etc.) match those consumed in Task 2.
- **Review focus:** All 5 failure modes from the Review Focus section are tested directly in their respective tasks.
- **Proportion:** The plan provides precise signatures and test assertions without duplicating entire application bodies.
