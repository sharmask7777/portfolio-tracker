# Stock Intersection Complete Breakup & Arbitrage Exclusion Toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provide a complete, non-truncated look-through of all underlying stocks across mutual funds with authentic, differentiated weights (eliminating the generic 9.0%/8.2% collision), and add a configurable toggle to exclude arbitrage funds.

**Architecture:** 
1. Backend: Expand `resolve_holdings` in `portfolio-api` with category-aware resolution (US Equities, Nifty 50, Nifty Next 50, Parag Parikh, Mid/Small, Arbitrage) with realistic weights and complete holding lists using canonical names.
2. Backend: Add `exclude_arbitrage` filtering to `compute_portfolio_exposures` and expose via `GET /api/portfolio/{id}/exposures?excludeArbitrage=true`.
3. Frontend: Add a styled "Exclude Arbitrage Funds" toggle (default: OFF) to `IntersectionView`, display all returned stocks without truncation, and manage re-fetching state cleanly in `App.tsx`.

**Tech Stack:** Rust (`axum`, `serde`, `rust_decimal`), React (`TypeScript`, `lucide-react`), Vitest, Cargo test suites.

**Spec:** [`docs/superpowers/specs/2026-11-01-stock-intersection-complete-breakup-and-arbitrage-toggle-design.md`](file:///Users/shaleensharma/workplace/gemini_ws/portfolio-tracker/docs/superpowers/specs/2026-11-01-stock-intersection-complete-breakup-and-arbitrage-toggle-design.md)

## Global Constraints

- Units $\Delta \le 0.0001$, Money $\Delta \le ₹0.01$, Returns & XIRR $\Delta \le 10^{-6}$ (Invariant Oracle Law).
- Strict Zero-Any Mandate: zero `any` in `frontend/src/`.
- Strict Zero-I/O Invariant in domain engine.
- Synthetic data only: no real PII or real PANs.
- Coverage gates: Backend $\ge 80\%$, Frontend lines $\ge 88\%$, statements $\ge 86\%$, funcs $\ge 85\%$, branches $\ge 65\%$.

## Review Focus

1. **Foreign/US Funds with Indian Fallback:** US equity funds (e.g. NASDAQ 100, S&P 500) must hold US technology/large-cap equities (Apple, Microsoft, NVIDIA, Amazon, Alphabet) and must NOT hold Indian bank stocks (HDFC Bank, ICICI Bank).
2. **Duplicate Weight Collisions:** Edelweiss Arbitrage, ICICI NASDAQ 100, Invesco Arbitrage, UTI Nifty 50, and UTI Nifty Next 50 must NOT all share identical fallback percentages (e.g. 9.0%).
3. **Arbitrage Exclusion Mathematical Recalculation:** When `excludeArbitrage=true`, all arbitrage funds must be excluded from `total_equity_value`, and the remaining active equity stocks must have their `percentage` recalculated against the reduced denominator.
4. **Complete Holding Visibility:** Stock intersection must not artificially truncate or slice results; all identified stocks must be displayed.
5. **Toggle Default:** "Exclude Arbitrage Funds" toggle must default to OFF on initial load.

---

### Task 1: Differentiated Category-Aware Holding Resolver

**Files:**
- Modify: `backend-rs/crates/portfolio-api/src/routes/portfolio.rs:808-913`
- Test: `backend-rs/crates/portfolio-api/tests/contract_tests.rs`

**Interfaces:**
- Consumes: `isin: &str`, `scheme_name: &str`
- Produces: `resolve_holdings(isin: &str, scheme_name: &str) -> (String, Vec<FundHolding>)`

- [x] **Step 1: Write failing tests in `contract_tests.rs` verifying differentiated holdings and US equity resolution**

```rust
#[tokio::test]
async fn test_resolve_holdings_differentiated_categories() {
    let (_, us_holdings) = resolve_holdings("US001", "ICICI Prudential NASDAQ 100 Index Fund");
    assert!(us_holdings.iter().any(|h| h.name == "Apple Inc." || h.name == "Microsoft Corp."));
    assert!(!us_holdings.iter().any(|h| h.name == "HDFC Bank Ltd."));

    let (_, next50_holdings) = resolve_holdings("NEXT50", "UTI Nifty Next 50 Index Fund");
    assert!(next50_holdings.iter().any(|h| h.name == "Bharat Electronics Ltd." || h.name == "Trent Ltd."));
    assert!(!next50_holdings.iter().any(|h| h.name == "HDFC Bank Ltd."));

    let (_, arb_holdings) = resolve_holdings("ARB01", "Edelweiss Arbitrage Fund");
    let (_, nifty_holdings) = resolve_holdings("NIFTY01", "UTI Nifty 50 Index Fund");
    // Weights must not be identical 9.0% across all funds
    let arb_hdfc = arb_holdings.iter().find(|h| h.name.contains("HDFC Bank"));
    let nifty_hdfc = nifty_holdings.iter().find(|h| h.name.contains("HDFC Bank"));
    if let (Some(a), Some(n)) = (arb_hdfc, nifty_hdfc) {
        assert_ne!(a.weight, n.weight);
    }
}
```

- [x] **Step 2: Run test to verify it fails**

Run: `(cd backend-rs && cargo test --test contract_tests test_resolve_holdings_differentiated_categories)`
Expected: FAIL (because US fund currently returns HDFC Bank 9.0%).

- [x] **Step 3: Implement category-aware resolution in `backend-rs/crates/portfolio-api/src/routes/portfolio.rs`**

Add specific matchers for:
1. US / Global funds (`nasdaq`, `s&p 500`, `s and p 500`, `us equity`, `total stock market`): Return Apple, Microsoft, NVIDIA, Amazon, Alphabet, Meta, Tesla, Broadcom, etc.
2. Nifty Next 50 (`next 50`, `next50`): Return Trent, Bharat Electronics, Hindustan Aeronautics, Tata Power, REC, PFC, Cholamandalam, Siemens, DLF, etc.
3. Nifty 50 (`nifty 50`, `nifty50`): Return expanded 25+ top constituents with realistic weights (HDFC Bank 11.2%, Reliance 9.1%, ICICI Bank 7.9%, Infosys 5.8%, etc.).
4. Arbitrage funds (`arbitrage`): Return canonical arbitrage equity holdings with distinct weights (e.g. HDFC Bank 6.5%, Reliance 5.8%, ICICI Bank 4.2%, ITC 3.5%, etc.).
5. Fallback: Expanded diversified basket with non-uniform weights.

- [x] **Step 4: Run test to verify it passes**

Run: `(cd backend-rs && cargo test --test contract_tests test_resolve_holdings_differentiated_categories)`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add backend-rs/crates/portfolio-api/src/routes/portfolio.rs backend-rs/crates/portfolio-api/tests/contract_tests.rs
git commit -m "feat(portfolio-api): add category-aware fund holding resolution with authentic US and Next 50 holdings"
```

---

### Task 2: Backend Arbitrage Exclusion in Exposure Computation & API Route

**Files:**
- Modify: `backend-rs/crates/portfolio-api/src/routes/portfolio.rs:937-1066, 1685-1692`
- Test: `backend-rs/crates/portfolio-api/tests/contract_tests.rs`

**Interfaces:**
- Consumes: `state: &AppState`, `user_id: Uuid`, `target_id: &str`, `exclude_arbitrage: bool`
- Produces: `pub async fn compute_portfolio_exposures(state: &AppState, user_id: Uuid, target_id: &str, exclude_arbitrage: bool) -> Result<Vec<StockExposure>, ApiError>`
- Route: `GET /api/portfolio/{id}/exposures?excludeArbitrage=true`

- [x] **Step 1: Write failing test in `contract_tests.rs` for `excludeArbitrage` query param**

```rust
#[tokio::test]
async fn test_exposures_exclude_arbitrage_query_param() {
    // Setup portfolio with 1 equity fund and 1 arbitrage fund
    // GET /api/portfolio/{id}/exposures?excludeArbitrage=false -> contains contributions from arbitrage fund
    // GET /api/portfolio/{id}/exposures?excludeArbitrage=true -> does NOT contain contributions from arbitrage fund
}
```

- [x] **Step 2: Run test to verify it fails**

Run: `(cd backend-rs && cargo test --test contract_tests test_exposures_exclude_arbitrage_query_param)`
Expected: FAIL.

- [x] **Step 3: Update `compute_portfolio_exposures` and `get_exposures` route in `portfolio.rs`**

1. In `compute_portfolio_exposures`, accept `exclude_arbitrage: bool`.
2. When `exclude_arbitrage == true`, skip any folio where `asset.name.to_lowercase().contains("arbitrage")`.
3. In `get_exposures`, accept `Query(params): Query<HashMap<String, String>>`. Parse `exclude_arbitrage = params.get("excludeArbitrage").or_else(|| params.get("exclude_arbitrage")).map(|v| v == "true").unwrap_or(false)`.
4. Update callers of `compute_portfolio_exposures` (e.g. `health.rs` passes `false`).

- [x] **Step 4: Run test to verify it passes**

Run: `(cd backend-rs && cargo test --test contract_tests test_exposures_exclude_arbitrage_query_param)`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add backend-rs/crates/portfolio-api/src/routes/portfolio.rs backend-rs/crates/portfolio-api/src/routes/health.rs backend-rs/crates/portfolio-api/tests/contract_tests.rs
git commit -m "feat(portfolio-api): support excludeArbitrage query parameter in portfolio exposures"
```

---

### Task 3: Frontend `IntersectionView` Toggle Switch & Complete Breakup

**Files:**
- Modify: `frontend/src/components/Analytics/IntersectionView.tsx`
- Test: `frontend/src/components/Analytics/IntersectionView.test.tsx`

**Interfaces:**
- Consumes: `IntersectionViewProps { exposures: StockExposure[]; isLoading?: boolean; onUploadClick?: () => void; excludeArbitrage?: boolean; onToggleExcludeArbitrage?: (val: boolean) => void; }`
- Produces: UI toggle switch rendered in controls bar, triggering `onToggleExcludeArbitrage`.

- [x] **Step 1: Write failing tests in `IntersectionView.test.tsx`**

```tsx
it('renders the Exclude Arbitrage Funds toggle defaulting to unchecked', () => {
  render(<IntersectionView exposures={mockExposures} excludeArbitrage={false} />);
  const toggle = screen.getByRole('checkbox', { name: /exclude arbitrage/i });
  expect(toggle).not.toBeChecked();
});

it('calls onToggleExcludeArbitrage when toggle switch is clicked', () => {
  const onToggle = vi.fn();
  render(<IntersectionView exposures={mockExposures} excludeArbitrage={false} onToggleExcludeArbitrage={onToggle} />);
  const toggle = screen.getByRole('checkbox', { name: /exclude arbitrage/i });
  fireEvent.click(toggle);
  expect(onToggle).toHaveBeenCalledWith(true);
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `(cd frontend && npm test -- IntersectionView.test.tsx)`
Expected: FAIL.

- [x] **Step 3: Implement toggle switch and complete list rendering in `IntersectionView.tsx`**

1. Update `IntersectionViewProps` with `excludeArbitrage?: boolean` and `onToggleExcludeArbitrage?: (val: boolean) => void`.
2. Add a clean, accessible toggle switch component in the controls bar next to the sector selector:
   - Checkbox with aria-label `"Exclude Arbitrage Funds"`.
   - Clear visual label with indicator for active/inactive state.
3. Ensure no `.slice()` or limits restrict `filteredExposures`.

- [x] **Step 4: Run test to verify it passes**

Run: `(cd frontend && npm test -- IntersectionView.test.tsx)`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add frontend/src/components/Analytics/IntersectionView.tsx frontend/src/components/Analytics/IntersectionView.test.tsx
git commit -m "feat(frontend): add Exclude Arbitrage Funds toggle to IntersectionView"
```

---

### Task 4: Frontend `App.tsx` Integration & Data Flow

**Files:**
- Modify: `frontend/src/App.tsx:74, 176-190, 851-855`
- Test: `frontend/src/App.test.tsx` or new integration test

**Interfaces:**
- Consumes: `api.get(`${API_ENDPOINTS.PORTFOLIO}/${id}/exposures?excludeArbitrage=${excludeArbitrage}`)`
- Produces: Synchronized `exposures` state updated whenever `excludeArbitrage` changes.

- [x] **Step 1: Write failing test in `frontend/src/App.test.tsx` verifying exposures fetch passes `excludeArbitrage`**

- [x] **Step 2: Run test to verify it fails**

Run: `(cd frontend && npm test -- App.test.tsx)`
Expected: FAIL.

- [x] **Step 3: Implement `excludeArbitrage` state and fetch handler in `App.tsx`**

1. Add `const [excludeArbitrage, setExcludeArbitrage] = useState(false);`.
2. Create `fetchExposures(portfolioId: string, excludeArb: boolean)` that calls `api.get(...)`.
3. Pass `excludeArbitrage={excludeArbitrage}` and `onToggleExcludeArbitrage={handleToggleExcludeArbitrage}` to `<IntersectionView />`.
4. When toggled, update state and re-fetch exposures.

- [x] **Step 4: Run test to verify it passes**

Run: `(cd frontend && npm test -- App.test.tsx)`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add frontend/src/App.tsx frontend/src/App.test.tsx
git commit -m "feat(frontend): wire excludeArbitrage toggle in App.tsx to exposures API"
```

---

### Task 5: Full Verification & Coverage Gates

**Files:**
- All modified backend and frontend files.

- [ ] **Step 1: Run full hermetic backend suite**

Run:
```bash
(cd backend-rs && cargo test --workspace)
(cd backend-rs && cargo clippy --workspace --all-targets -- -D warnings)
(cd backend-rs && cargo fmt --check)
(cd backend-rs && cargo run --package portfolio-parity)
```
Expected: All pass cleanly with zero errors/warnings.

- [ ] **Step 2: Run full hermetic frontend suite and coverage gates**

Run:
```bash
(cd frontend && npm run build)
(cd frontend && npm run test:unit)
(cd frontend && npm run test:coverage)
```
Expected: Pass cleanly with zero type errors, zero warnings, and meeting all coverage thresholds.

- [ ] **Step 3: Commit and push**

```bash
git commit --allow-empty -m "chore: verify full hermetic suite and coverage gates"
git push origin feat/stock-intersection-complete-breakup-and-arbitrage-toggle
```
