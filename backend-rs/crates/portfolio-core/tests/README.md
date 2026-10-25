# `portfolio-core` Test Architecture & Domain Catalog

This directory contains the hermetic test suites for `portfolio-core`, the pure domain calculation engine of Portfolio Tracker.

---

## 1. Architectural Invariants

### 1.1 Strict Zero-I/O Policy
`portfolio-core` enforces a **strict Zero-I/O invariant**. It contains **no database access, no network calls, no async runtime dependencies, and no live filesystem mutations**. All calculations:
- Holding aggregation & FIFO matching
- Statutory Indian capital gains tax (Sections 112A, 111A, 50AA, 70, 55(2)(ac))
- Portfolio XIRR and annualized performance
- Underlying stock look-through and X-Ray overlap

are executed as **pure, deterministic, in-memory functions** over strongly-typed financial data structures (`Money`, `Units`, `Nav`, `FolioNumber`, `Pan`, `Isin`).

### 1.2 Hermetic Determinism & Precision Bounds
- Financial arithmetic uses arbitrary-precision fixed decimals (`rust_decimal::Decimal`), eliminating IEEE 754 floating-point inaccuracies.
- Precision tolerances enforced across tests:
  - Units: $\Delta \le 0.0001$
  - Monetary values: $\Delta \le ₹0.01$ (banker's rounding)
  - Return percentages & XIRR: $\Delta \le 10^{-6}$

### 1.3 Synthetic Data Only (Privacy Mandate)
Per the repository's data privacy invariants:
- **Zero Real Data Commitment**: Absolutely NO real Permanent Account Numbers (PANs), investor names, email addresses, phone numbers, folio numbers, bank accounts, or real CAS statement payloads (`parsed_cas.json`, `*.cas.json`) may exist in code, comments, or test fixtures.
- All test fixtures and properties exclusively use synthetic identifiers (e.g. `ABCDE1234F`, `ALPAC1001A`, `AURORA-001`).

---

## 2. Test Suite Catalog

| Test File | Primary Domain | Methodology | Key Invariants Tested |
| :--- | :--- | :--- | :--- |
| [`tax_oracle_test.rs`](./tax_oracle_test.rs) | Statutory Tax Compliance | Property-Based Testing + Golden Vectors | Section 112A loss limitation, Budget 2024 cutoff (12.5% / 20%), Section 50AA slab taxation, Section 70 loss set-offs, Advance Tax quarter roll-up. |
| [`tax_compliance_test.rs`](./tax_compliance_test.rs) | ITR & Tax Reporting | Hermetic Scenario Integration | Schedule CG ITR verification gate, Advance Tax Table F, withdrawal simulation, post-tax XIRR parity, exit load mechanics. |
| [`mock_portfolios.rs`](./mock_portfolios.rs) | End-to-End Portfolio Lifecycle | 10 Canonical BDD Portfolios | Multi-folio consolidation, zero-holding isolation, partial redemptions, stock overlap, pure debt, alternative assets, family isolation, grandfathering, ELSS lock-in, folio purge. |
| [`proptests.rs`](./proptests.rs) | Pure Mathematical Invariants | QuickCheck / Property-Based Fuzzing | Conservation of units ($\sum \text{bought} - \sum \text{sold} = \text{balance}$), overlap symmetry, XIRR monotonicity with terminal value. |
| [`auditor_defensive_test.rs`](./auditor_defensive_test.rs) | Boundary Conditions & Edge Cases | Defensive Adversarial Testing | Sub-unit fractional dust ($< 0.001$), zero balances, extreme NAV, negative inputs, duplicate dates, empty transactions. |
| [`xirr_safeguards_test.rs`](./xirr_safeguards_test.rs) | Numerical Solver Safeguards | Bounded Solvers & Guardrails | Newton-Raphson non-convergence fallback, short-duration ($< 30$ days) fallback to absolute return, clamping to $[-100\%, +1000\%]$. |
| [`types_test.rs`](./types_test.rs) | Financial Primitives & Serialization | Unit Tests + Property Tests | `Money` addition/subtraction identities, banker's rounding, `Units` 4-decimal precision, string validation for `Pan`, `FolioNumber`, `Isin`. |
| [`fixtures/golden_tax_vectors.json`](./fixtures/golden_tax_vectors.json) | Ground-Truth Oracle Vectors | JSON Spec Test Matrix | 33 statutory vectors covering grandfathering, tax classifications, capital loss set-offs, and advance tax dates. |

---

## 3. Deep-Dive: Suite Specifications & Responsibilities

### 3.1 `tax_oracle_test.rs`
- **Location:** `backend-rs/crates/portfolio-core/tests/tax_oracle_test.rs`
- **Responsibility:** Validates the statutory tax calculation engine against Indian Income Tax laws and Union Budget 2024 amendments.
- **Invariants Enforced:**
  1. **Section 112A Grandfathering Loss Limitation:** For equity acquired prior to Feb 1, 2018, $\text{Deemed Cost} = \max(\text{Actual Cost}, \min(\text{FMV as of 31-Jan-2018}, \text{Sale Value}))$. Actual losses are never amplified or converted into phantom gains.
  2. **Budget 2024 Cutoff:** Transactions on or after July 23, 2024 strictly mandate 12.5% LTCG and 20% STCG; Section 50AA debt mutual funds acquired after April 1, 2023 are taxed at the investor's slab rate regardless of holding period.
  3. **Section 70 Loss Set-Off Invariants:** Long-term capital losses (LTCL) can only offset LTCG. Short-term capital losses (STCL) offset slab gains, STCG, and LTCG in priority order. Taxable gain is never negative.
  4. **Advance Tax Period Conservation:** The sum of quarterly capital gains in Table F equals the total net realized capital gains for the fiscal year.
- **Fixtures:** Ingests `fixtures/golden_tax_vectors.json` at compile-time via `include_str!`.

### 3.2 `tax_compliance_test.rs`
- **Location:** `backend-rs/crates/portfolio-core/tests/tax_compliance_test.rs`
- **Responsibility:** Exercises the end-to-end tax calculation APIs used by frontend reports and API gateways.
- **Invariants Enforced:**
  - `verify_itr_invariants`: Acts as an invariant gate ensuring no invalid tax report can be emitted (e.g., negative exemptions, quarterly mismatches, exceeding statutory ₹1.25L exemption limits).
  - `calculate_unrealized_tax`: Computes unrealized tax liability using FIFO cost-basis and post-Budget 2024 rules.
  - `simulate_sell_transactions_with_metadata`: Evaluates tax deduction breakdowns and exit loads on hypothetical redemptions.
  - `calculate_portfolio_tax`: Validates multi-asset portfolios containing equity, debt, and liquid schemes across multiple financial years.

### 3.3 `mock_portfolios.rs`
- **Location:** `backend-rs/crates/portfolio-core/tests/mock_portfolios.rs`
- **Responsibility:** The canonical, hermetic BDD test suite implementing the 10 reference investor scenarios:
  1. **Aurora Growth Family:** Multi-folio scheme consolidation with distinct PANs into a single master position.
  2. **Zephyr Exited Fund:** Clean isolation of fully redeemed (zero-holding) schemes into closed positions without polluting active portfolio net worth.
  3. **Titan Bluechip Retained:** Partial redemptions applying strict FIFO accounting for remaining units, cost, and realized gains.
  4. **Olympus Hybrid:** Direct equities combined with mutual fund portfolios, validating underlying stock intersection and look-through.
  5. **Sovereign Safety:** Pure debt and liquid fund portfolios with zero equity exposure.
  6. **Nova Multi-Asset:** Multi-asset portfolios including Sovereign Gold Bonds (SGBs) and Real Estate.
  7. **Solaria Family Hub:** Multi-member profile isolation and cascading deletion integrity.
  8. **Vintage Heritage Fund:** Section 112A LTCG grandfathering using historical Jan 31, 2018 Fair Market Value (FMV).
  9. **Tax Optimizer ELSS:** Statutory 3-year lock-in enforcement separating locked units from harvestable/redeemable units.
  10. **Lifecycle Manager:** Manual closing of folios and complete portfolio purge integrity.

### 3.4 `proptests.rs`
- **Location:** `backend-rs/crates/portfolio-core/tests/proptests.rs`
- **Responsibility:** Property-based fuzzing using `proptest` (256+ generated cases per run) to mathematically prove core domain identities.
- **Invariants Enforced:**
  - **Conservation of Units:** For any arbitrary sequence of purchases, SIPs, and valid redemptions, $\sum(\text{Bought Units}) - \sum(\text{Sold Units}) = \text{Latest Balance}$.
  - **Overlap Symmetry & Bounds:** For any two portfolios $A$ and $B$, $\text{Overlap}(A, B) = \text{Overlap}(B, A)$, $0\% \le \text{Overlap}(A, B) \le 100\%$, and $\text{Overlap}(A, A) = 100\%$.
  - **XIRR Monotonicity:** Increasing the terminal valuation of a portfolio while keeping all cash inflows constant strictly increases (or preserves) the calculated XIRR.
  - **Section 112A Bounds:** Grandfathered deemed cost is always bounded: $\text{Deemed Cost} \ge \text{Actual Cost}$ and $\text{Gain} \le \text{Sale Proceeds} - \text{Actual Cost}$.

### 3.5 `auditor_defensive_test.rs`
- **Location:** `backend-rs/crates/portfolio-core/tests/auditor_defensive_test.rs`
- **Responsibility:** Defensive checks guarding against corrupted CAS statements, data importer anomalies, and floating-point edge cases.
- **Invariants Enforced:**
  - Fractional dust rejection ($< 0.001$ units remaining in CAS statement must not resurrect closed positions).
  - FIFO fallback behavior when transaction records lack cumulative balance fields.
  - Stock exposure look-through handling when funds report empty or duplicate underlying holding tables.
  - Negative taxable gain clamping.

### 3.6 `xirr_safeguards_test.rs`
- **Location:** `backend-rs/crates/portfolio-core/tests/xirr_safeguards_test.rs`
- **Responsibility:** Numerical analysis and solver stability for money-weighted rate of return (XIRR).
- **Invariants Enforced:**
  - Short-duration holding protection: For holdings held under 30 days, annualized compounding generates astronomical runaway rates (e.g. $+139,000,000\%$). The engine automatically falls back to absolute return.
  - Bounded results: Prevents unbounded solver outputs by clamping return rates between $-100\%$ and $+1000\%$.
  - Same-day cash flow handling and non-converging cash flow gracefully falling back to absolute return.

### 3.7 `types_test.rs`
- **Location:** `backend-rs/crates/portfolio-core/tests/types_test.rs`
- **Responsibility:** Validates the core financial primitive domain types.
- **Invariants Enforced:**
  - `Money`: Exact fixed-precision arithmetic, banker's rounding to 2 decimal places, elimination of IEEE 754 precision loss (`0.10 + 0.20 == 0.30`).
  - `Units`: 4-decimal precision arithmetic and rounding.
  - `Nav`: 4-decimal precision NAV and exact unit multiplication.
  - Value Objects: Strict regex validation for Indian PAN (`[A-Z]{5}[0-9]{4}[A-Z]`), ISIN (`[A-Z]{2}[A-Z0-9]{9}[0-9]`), and Folio Numbers.

---

## 4. How to Extend Backend Tests

### 4.1 Adding a New Statutory Tax Vector
1. Open [`fixtures/golden_tax_vectors.json`](./fixtures/golden_tax_vectors.json).
2. Append a new scenario entry under `grandfathering_vectors`, `classification_vectors`, `loss_set_off_vectors`, or `advance_tax_vectors`.
3. Use synthetic fund names and valid historical/post-budget dates.
4. Run `cargo test --package portfolio-core --test tax_oracle_test` to verify compile-time inclusion and test assertion.

### 4.2 Adding a Property Test
1. Open [`proptests.rs`](./proptests.rs) or create a property in the relevant test file.
2. Define input generators using `proptest::strategy::Strategy` with bounded ranges.
3. Assert algebraic properties and financial invariants across generated inputs.
4. Keep execution fast: standard case count is 256.

### 4.3 Adding an Edge Case or Regression Test
1. If the issue is related to CAS input corruption or numerical anomalies, add a test to [`auditor_defensive_test.rs`](./auditor_defensive_test.rs).
2. If related to tax law interpretation or reporting, add to [`tax_compliance_test.rs`](./tax_compliance_test.rs).
3. If related to XIRR solver convergence, add to [`xirr_safeguards_test.rs`](./xirr_safeguards_test.rs).

---

## 5. Verification Commands

Run all backend tests from repository root:
```bash
cargo test --workspace
```

Run only `portfolio-core` test suites:
```bash
cargo test --package portfolio-core --tests
```

Run a specific suite with full console output:
```bash
cargo test --package portfolio-core --test tax_oracle_test -- --nocapture
cargo test --package portfolio-core --test mock_portfolios -- --nocapture
```

Verify formatting and lint compliance:
```bash
cargo fmt --check
cargo clippy --workspace --all-targets -- -D warnings
```
