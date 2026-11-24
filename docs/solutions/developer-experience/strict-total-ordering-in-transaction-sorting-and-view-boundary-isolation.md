---
title: "Strict Total Ordering in Rust Slice Sorting and Zero-Business-Logic View Boundary Isolation"
date: "2026-11-24"
module: "portfolio-core, portfolio-api, frontend, mobile"
problem_type: "algorithm_panic_and_architecture_drift"
component: "domain_engine"
severity: "critical"
symptoms:
  - "Docker simulation crashes with 502 Bad Gateway upon querying /api/portfolio/summary after CAS upload"
  - "Backend container logs display: thread 'tokio-rt-worker' panicked at user-provided comparison function does not correctly implement a total order"
  - "Discrepancy between Web and Mobile Reality Check figures due to duplication of financial compounding math in mobile view layer"
root_cause: "intransitive_sort_comparator_and_view_logic_creep"
resolution_type: "total_order_comparator_refactor_and_backend_ssot_migration"
related_components:
  - "holdings_lot_allocation"
  - "reality_check_engine"
  - "static_boundary_guardrail"
  - "agent_driven_uat_suite"
tags:
  - "rust-driftsort"
  - "total-ordering"
  - "transitivity"
  - "cas-upload"
  - "reality-check"
  - "zero-business-logic"
  - "display-ready-dto"
status: "verified"
---

# Strict Total Ordering in Rust Slice Sorting and Zero-Business-Logic View Boundary Isolation

## Problem
During local Docker simulation (`docker-compose.yml`), uploading a Consolidated Account Statement (CAS) succeeded during initial ingestion but triggered immediate server crashes (`502 Bad Gateway`) upon querying `GET /api/portfolio/summary`. Simultaneously, subtle discrepancies existed between Web and Mobile in "Reality Check" metric calculations (Fisher deflator inflation drag, post-tax XIRR, and purchasing power erosion) due to duplicate math implementation in mobile view components.

## Symptoms
- **Backend Thread Panic**: Under Rust 1.81+ (`driftsort`/`smallsort`), worker threads threw:
  ```text
  thread 'tokio-rt-worker' panicked at library/core/src/slice/sort/shared/smallsort.rs:854:5:
  user-provided comparison function does not correctly implement a total order
  ```
- **Nginx 502 Bad Gateway**: Upstream Axum process terminated connection prematurely while evaluating portfolio summaries.
- **Cross-Platform Math Drift**: Mobile view layers recalculated compounding deflators and tax rates independently from Web, causing visual desynchronization and invariant violations.

## Root Cause Analysis

### 1. Intransitive Comparator Cycle in `sort_transactions`
In `backend-rs/crates/portfolio-core/src/holdings/lot.rs`, transactions on the same calendar date were ordered using:
```rust
if !a.balance.is_zero() && !b.balance.is_zero() && a.balance != b.balance {
    let a_is_sell = is_unit_redemption(a.tx_type) || a.units.is_negative();
    if a_is_sell {
        b.balance.cmp(&a.balance)
    } else {
        a.balance.cmp(&b.balance)
    }
} else {
    std::cmp::Ordering::Equal
}
```

When CAS statements contain same-day transactions where some have `balance > 0` (e.g., standard mutual fund purchases) and others have `balance == 0` (e.g., stamp duty or transaction charges):
1. **$P_1$ ($balance = 4301$, $id = \text{9a48a7cb}$)** vs **$P_2$ ($balance = 12529$, $id = \text{3aa53bf0}$)**:
   Both balances non-zero $\implies 4301 < 12529 \implies P_1 < P_2$.
2. **$P_2$** vs **$S_3$ ($balance = 0$, $id = \text{6a5f8a36}$)**:
   One has $balance = 0 \implies$ comparator returned `Equal`, falling back to ID tie-break: $\text{3aa...} < \text{6a5...} \implies P_2 < S_3$.
3. **$S_3$** vs **$P_1$**:
   One has $balance = 0 \implies$ comparator returned `Equal`, falling back to ID tie-break: $\text{6a5...} < \text{9a4...} \implies S_3 < P_1$.

This created an **intransitive cycle**:
$$P_1 < P_2 < S_3 < P_1$$
Standard library sorting in Rust 1.81+ explicitly validates transitivity during bidirectional merge and panics on violation.

---

## Solution

### 1. Mathematically Proven Total Order in `sort_transactions`
Replaced conditional equality with a total ordering key tuple in `backend-rs/crates/portfolio-core/src/holdings/lot.rs`:
```rust
pub fn sort_transactions(transactions: &[Transaction]) -> Vec<Transaction> {
    let mut sorted = transactions.to_vec();
    sorted.sort_by(|a, b| {
        a.date
            .cmp(&b.date)
            .then_with(|| {
                let a_is_sell = is_unit_redemption(a.tx_type) || a.units.is_negative();
                let b_is_sell = is_unit_redemption(b.tx_type) || b.units.is_negative();
                a_is_sell.cmp(&b_is_sell)
            })
            .then_with(|| {
                let a_is_sell = is_unit_redemption(a.tx_type) || a.units.is_negative();
                if a_is_sell {
                    // For redemptions on the same date: earlier redemption has higher balance
                    b.balance.cmp(&a.balance)
                } else {
                    // For purchases on the same date: positive balances sort ascending, zero-balance sort after
                    let a_key = (a.balance == Units::ZERO, a.balance);
                    let b_key = (b.balance == Units::ZERO, b.balance);
                    a_key.cmp(&b_key)
                }
            })
            .then_with(|| a.id.cmp(&b.id))
    });
    sorted
}
```

### 2. Float Sorting Hardening with `total_cmp`
Replaced loose `partial_cmp(...).unwrap_or(Equal)` with `total_cmp` and secondary tie-breakers across:
- `backend-rs/crates/portfolio-api/src/routes/portfolio.rs` (stock and sector exposure sorting).
- `backend-rs/crates/portfolio-api/src/routes/health.rs` (concentration insights).

### 3. Display-Ready Backend SSOT for Reality Check Drags
Unified all financial and tax math in `backend-rs/crates/portfolio-core/src/performance/metrics.rs`. The backend emits a display-ready DTO with precomputed waterfall stages:
```rust
DragDecompositionDto {
    nominal_xirr,
    post_tax_xirr,
    debt_drag,
    equity_drag,
    cess_and_other_drag,
    inflation_drag,
    total_tax_drag,
    total_overall_drag,
    real_post_tax_xirr,
    benchmark_spread,
    post_tax_value,
    purchasing_power_value,
    purchasing_power_loss,
    stages: vec![
        DragWaterfallStageDto { step: 1, key: "gross_nominal", label: "Gross Nominal", rate, drag: 0.0, ... },
        DragWaterfallStageDto { step: 2, key: "debt_drag", label: "Sec 50AA Debt Drag", ... },
        DragWaterfallStageDto { step: 3, key: "equity_drag", label: "Sec 112A/111A Equity", ... },
        DragWaterfallStageDto { step: 4, key: "cess_drag", label: "Cess & Overheads", ... },
        DragWaterfallStageDto { step: 5, key: "inflation_drag", label: "CPI Inflation Drag", ... },
        DragWaterfallStageDto { step: 6, key: "real_xirr", label: "Real Purchasing XIRR", ... },
    ],
}
```
Both Web (`DragWaterfall.tsx`) and Mobile (`RealityCheckBanner.tsx`, `RealityCheckRow.tsx`) now act strictly as zero-logic paint layers consuming these display-ready stages.

### 4. Static View Boundary Guardrail (`scripts/check-view-layer-boundaries.py`)
Introduced automated AST and regex analysis scanning 149 view files across Web and Mobile, statically forbidding:
- Statutory tax multiplications (`* 0.125`, `* 0.20`, `* 0.04`, `* 0.15`, `* 0.30`).
- Fisher deflator compounding math (`Math.pow(1 + ...)`).
- Tax drag subtractions (`xirr - postTaxXirr`).
- Database or calculation engine imports in presentation components.

### 5. Productized Agent-Driven UAT Suite (`scripts/run-uat-suite.sh`)
Built a unified runner executing end-to-end user acceptance tests:
- `frontend/tests/uat/comprehensive-uat.spec.ts` (Playwright Web UAT).
- `mobile/src/e2e/uat-comprehensive.test.tsx` (Vitest Mobile Android & iOS UAT).
- Mandated via Section 11 of `AGENTS.md` before merging non-trivial changes.

---

## Invariants & Test Coverage
1. **Property 5 Invariant (`proptests.rs`)**:
   `prop_transaction_sorting_strict_total_order_and_transitivity` mathematically asserts that for all generated triplets $(A, B, C)$, if $A \le B$ and $B \le C$, then $A \le C$ holds across arbitrary positive and zero balances, redemptions, and charges.
2. **API Contract Invariant (`contract_tests.rs`)**:
   `test_portfolio_summary_with_same_day_zero_balance_stamp_duty_and_purchases` validates that portfolios with same-day fees/stamp duty and purchases calculate summaries with 200 OK and 0 panics.
3. **Web Playwright Acceptance**:
   Full test pass verifying 6-stage drag waterfall, Section 112A ₹1.25L exemption progress, and multi-PAN scope switching.
4. **Mobile Platform Journeys**:
   Full pass across simulated Android and iOS lifecycles verifying biometric unlock, zero-balance resilience, offline persistence, and outbox queuing.
