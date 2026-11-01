# Design Document: Stock Intersection Complete Breakup & Arbitrage Exclusion Toggle

**Date:** 2026-11-01  
**Status:** Approved for Implementation  
**Target File:** `docs/superpowers/specs/2026-11-01-stock-intersection-complete-breakup-and-arbitrage-toggle-design.md`

---

## 1. Intent & The Why

Investors using the Stock Intersection / X-Ray view need an authentic, complete look-through of their equity exposure across mutual funds. Currently:
1. **Holding Truncation & Mock Collisions:** Unmatched funds fall into a rudimentary 8-stock fallback where HDFC Bank is hardcoded at 9.0%, and Parag Parikh funds hardcode 8.2%. As a result:
   - Foreign equity funds (e.g., ICICI NASDAQ 100, Motilal Oswal S&P 500, Navi US FoF) show Indian bank stocks like HDFC Bank at 9.0% instead of US equities (Apple, Microsoft, NVIDIA, etc.).
   - Diverse Indian index and active funds (UTI Nifty 50, UTI Nifty Next 50, Edelweiss Arbitrage, Invesco Arbitrage) all report identical 9.0% holdings.
   - Holdings stop after only 5 to 10 stocks (~40-50% of the fund), leaving the remaining portfolio invisible.
2. **Arbitrage Confusion:** Arbitrage mutual funds (which hold fully-hedged cash-futures arbitrage and debt/cash equivalents) are treated as regular active equity risk. Investors need the ability to toggle arbitrage funds off to evaluate pure, unhedged equity stock overlap.

This feature provides:
- A complete, non-truncated breakup of all underlying stocks across funds.
- Authentic, category-aware fund holding resolution with realistic, non-colliding percentages across US funds, Nifty 50, Nifty Next 50, Flexi Cap, and Arbitrage funds.
- A configurable UI toggle in Stock Intersection to exclude arbitrage funds, defaulting to **OFF**.

---

## 2. Goals, Non-Goals, and Anti-Goals

### Goals
- **Complete Look-Through Breakup:** Show all underlying stocks across portfolio funds without arbitrary truncation or stopping at a top-10 threshold.
- **Accurate & Realistic Percentages:** Differentiate fund holding profiles so that:
  - US index/active funds hold authentic US tech/large-cap equities.
  - Nifty 50 and Nifty Next 50 funds hold their proper respective constituents.
  - Flexi cap and multi-cap funds have diverse, realistic weights.
  - Different funds do not share identical dummy fallback percentages (e.g. 9.0%).
- **Arbitrage Exclusion Toggle:**
  - Add a visible toggle in `IntersectionView` to "Exclude Arbitrage Funds".
  - Default state: **OFF** (arbitrage funds are included by default).
  - When toggled **ON**, arbitrage schemes (e.g., schemes with "Arbitrage" in their name or category) are excluded from the stock exposure calculation and table.
- **Hermetic Contract & Verification:**
  - Support `excludeArbitrage` query parameter on `GET /api/portfolio/{id}/exposures`.
  - Maintain zero-any in TypeScript and pass all hermetic verification gates (`cargo test`, `cargo clippy`, `vitest`, parity, coverage).

### Non-Goals
- Real-time third-party scraping or live AMFI API integration during runtime (hermetic zero-I/O mandate in domain engine).
- Changing the existing table columns (Stock Name, Sector, Total Exposure %, Total Value, Contributing Funds & Allocation).

### Anti-Goals
- Relaxing test precision bounds or altering golden vectors to fit arbitrary values.
- Introducing `any` types in TypeScript.
- Breaking existing mock portfolio invariants (Schemes consolidation, zero-holding isolation).

---

## 3. Constraints & Architectural Mandates

1. **Zero-Any Mandate:** No `any` types in `frontend/src/`. Generated types or strictly typed interfaces only.
2. **Strict Zero-I/O Invariant:** Calculation functions must remain pure and deterministic in memory.
3. **Mandatory Hermetic Sequence:** Must pass:
   - `cargo test --workspace`
   - `cargo clippy --workspace --all-targets -- -D warnings`
   - `cargo fmt --check`
   - `cargo test --package portfolio-api --test export_bindings`
   - `npm run build && npm run test:unit`
   - Parity harness and coverage gates.

---

## 4. Technical Specifications & Architecture

### A. Backend: Category-Aware Holding Resolution & Arbitrage Filtering
Located in `backend-rs/crates/portfolio-api/src/routes/portfolio.rs`:

1. **Holding Resolver (`resolve_holdings`):**
   - **Canonical Stock Naming (Builder Call):** All holdings use canonical company names (e.g., `"Reliance Industries Ltd."`, `"HDFC Bank Ltd."`, `"ICICI Bank Ltd."`) so they authentically overlap and aggregate when arbitrage is included.
   - **US Equities / Global Funds:** Matches names containing `nasdaq`, `s&p 500`, `s and p 500`, `us equity`, `us specific`, `total stock market`. Returns US leaders: Apple, Microsoft, NVIDIA, Amazon, Alphabet, Meta, Tesla, Berkshire Hathaway, Broadcom, etc., with realistic index weights.
   - **Nifty 50 Funds:** Matches `nifty 50` or `nifty50` (excluding `next 50`). Returns 20+ top Nifty 50 constituents (HDFC Bank ~11.5%, Reliance ~9.2%, ICICI Bank ~7.8%, Infosys ~5.8%, TCS ~3.8%, etc.).
   - **Nifty Next 50 Funds:** Matches `next 50` or `next50`. Returns Next 50 leaders (Trent, BEL, HAL, Tata Power, REC, PFC, Cholamandalam, Siemens, DLF, etc.).
   - **Parag Parikh Flexi Cap:** Distinct holdings (HDFC Bank 8.2%, Bajaj Holdings 7.1%, Power Grid 6.4%, ITC 5.8%, etc.).
   - **Arbitrage Funds:** Matches `arbitrage`. Holds canonical cash-futures arbitrage equity positions (e.g. Reliance, HDFC Bank, ICICI Bank, ITC, etc.) with distinctive weights.
   - **Mid & Small Cap Funds:** Expanded basket of mid and small cap companies.
   - **Fallback Basket:** Diversified multi-cap basket with varied weights instead of fixed 9.0%.

2. **Arbitrage Exclusion in `compute_portfolio_exposures`:**
   - Add parameter `exclude_arbitrage: bool`.
   - When `exclude_arbitrage == true`, any active folio whose asset name or category contains `"arbitrage"` is skipped before calculating `total_equity_value` and aggregating stock exposures.
   - Expose via `GET /api/portfolio/{id}/exposures?excludeArbitrage=true` (and `?exclude_arbitrage=true`).
   - Query parameter parsing via Axum `Query<HashMap<String, String>>`.

### B. Frontend: UI Toggle & Complete Breakup
Located in `frontend/src/components/Analytics/IntersectionView.tsx` and `frontend/src/App.tsx`:

1. **Server-Side Re-Fetch Architecture (Builder Call):**
   - The toggle triggers a re-fetch via `GET /api/portfolio/{id}/exposures?excludeArbitrage=${excludeArbitrage}`.
   - This ensures mathematical correctness: total equity denominator, individual stock values, and exposure percentages are recalculated with precision on the backend.
2. **State Management Scope (Builder Call):**
   - `excludeArbitrage` state (`boolean`, default `false`) is managed in `App.tsx` and passed to `IntersectionView` along with `onToggleExcludeArbitrage: (val: boolean) => void`.
   - When toggled in `IntersectionView`, `App.tsx` fetches the updated exposures and updates the state.
3. **Header Toggle Switch:**
   - Add a styled toggle switch / pill in `IntersectionView` controls header:
     - Label: `Exclude Arbitrage Funds`
     - Accessible button / switch with clear ON/OFF visual indicators.
     - Default: OFF.
4. **Complete Breakup Table:**
   - Display all returned stock rows without truncating or slicing.
   - Existing search filter, sector filter, and sortable headers operate seamlessly over the full dataset.
   - Keep existing summary metrics (Identified Companies, Total Value, Multi-Fund Overlap count) dynamically synced.

---

## 5. Builder Calls Summary

1. **Holding Naming:** Canonical stock names (`"Reliance Industries Ltd."`, `"HDFC Bank Ltd."`) are maintained across all funds including arbitrage, ensuring multi-fund overlap is mathematically detected when the toggle is OFF.
2. **Re-Fetch Strategy:** Server-side re-fetching on toggle to guarantee correct portfolio equity denominator and percentage recalculations.
3. **State Placement:** `App.tsx` manages `excludeArbitrage` state (defaulting to `false`) and passes it down to `IntersectionView`, keeping portfolio state synchronized.
