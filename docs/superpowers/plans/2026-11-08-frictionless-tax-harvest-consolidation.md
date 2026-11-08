# Implementation Plan: Frictionless Section 112A Tax-Free Harvesting Consolidation

## 1. Problem Statement & Root Cause
In Indian mutual fund holdings accumulated via monthly SIPs over 3–7 years, a single scheme/folio contains dozens of individual monthly purchase lots. The current Section 112A harvest ticket generator pushes every single qualifying purchase lot as an independent `HarvestingOpportunity`.

When formatted for the user, this produced **128 individual redemption steps** for only **3 mutual funds** (86 SIP lots for Aditya Birla ELSS, 15 lots for Aditya Birla PSU, 27 lots for Axis ELSS).

### Statutory & Platform Realities:
1. **FIFO Mandate by Law**: Under Section 45(2A) of the Income Tax Act and AMFI/SEBI regulations, mutual fund redemptions are strictly First-In, First-Out (FIFO). Investors cannot pick individual lots on MF Central, CAMS, KFintech, or AMC portals.
2. **Single Redemption Order**: An investor submits **one redemption order per scheme/folio** specifying total units or amount. The RTA automatically consumes the oldest units in FIFO order.
3. **Tax-Alpha / Gain-Density Efficiency**: The engine currently processes schemes in arbitrary input order, resulting in funds with 0.8% gain margins being liquidated alongside high-gain funds. Liquidating ₹4,000 for ₹33 of gain creates high turnover, tracking error, stamp duty, and settlement lag.
4. **Real Folio Number & Reinvestment Guidance**: Instructions must display the real folio number (not database UUIDs) and provide explicit reinvestment guidance to prevent reinvesting into 3-year ELSS lock-ins.

---

## 2. Architecture & Design Specification

### A. Domain Engine (`portfolio-core`)
1. **Field Enhancements to `HarvestingOpportunity`**:
   - `folio_id: Option<String>` (internal UUID)
   - `folio_number: Option<String>` (real CAS folio number e.g. `10482910/22`)
   - `scheme_name: String`
   - `units_to_harvest: Units` (summed total units across all qualifying lots in this scheme/folio)
   - `unrealized_gain: Money` (summed total tax-free gain)
   - `current_value: Money` (summed total current value)
   - `lots_count: usize` (number of SIP lots consolidated into this order)
   - `first_lot_date: Option<NaiveDate>` (earliest purchase date consumed)
   - `last_lot_date: Option<NaiveDate>` (latest purchase date consumed)
2. **Gain-Density Ranking (Knapsack Sorter)**:
   - For each candidate scheme/folio, evaluate the aggregate qualifying LTCG lots (holding $\ge$ 365d, unlocked ELSS $> 1095$d, zero exit load).
   - Compute scheme **Gain Density**:
     $$\text{Gain Density} = \frac{\sum \text{Qualifying Lot Gain}}{\sum \text{Qualifying Lot Value}}$$
   - Sort eligible schemes in **descending order of Gain Density**. High-density schemes are harvested first, achieving the ₹1.25L exemption with minimum capital turnover.
3. **Consolidation by Scheme & Folio**:
   - Rather than returning raw lots, accumulate qualifying lots into a single `HarvestingOpportunity` per `(folio_id, scheme_name)`.
   - Result: Exactly 1 to 4 actionable orders total.

### B. API Gateway & DTOs (`portfolio-api`)
1. Update `HarvestOpportunityDto`:
   - `folioNumber?: string | null`
   - `lotsCount?: number`
   - `firstLotDate?: string | null`
   - `lastLotDate?: string | null`
2. Update `routes/tax.rs`:
   - Populate `folio_number` from `folio.number` when building `FolioHarvestingInput`.
   - Update `export_bindings` and regenerate TypeScript types.

### C. Frontend Presentation (`frontend/src/`)
1. **`formatHarvestInstructions` in `TaxView.tsx`**:
   - Format orders with clear labels: `[ORDER 1 of N]`.
   - Show: Scheme Name, Real Folio Number, Total Units to Redeem (and approx gross value), Tax-Free LTCG Harvested, and FIFO Scope (`"Consolidates your oldest X monthly SIP lots (Jan 2021 – Feb 2024)"`).
   - Add **Reinvestment Advisory**:
     - Highlights T+2 settlement.
     - Explicit warning against repurchasing into ELSS funds (avoids fresh 3-year lock-in).
     - Recommends stepping up cost basis into open-ended equity/index funds.
2. **UI Table in `TaxView.tsx`**:
   - Add badge showing `X SIP lots consolidated`.
   - Display real folio number and date range.

---

## 3. Verification Sequence
1. Unit tests in `portfolio-core`:
   - `test_harvesting_consolidates_multiple_sip_lots_into_single_order`
   - `test_harvesting_prioritizes_high_gain_density_schemes`
2. Parity tests & verification pipeline (`./scripts/verify.sh` 8/8 stages).
3. Contract bindings export & `git diff --exit-code frontend/src/types/generated`.
4. Frontend build & unit tests (`pnpm --filter frontend build && pnpm --filter frontend test:unit`).
5. Playwright E2E tests (`frontend/tests/reality-check.spec.ts`).
