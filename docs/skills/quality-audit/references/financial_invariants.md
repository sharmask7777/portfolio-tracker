# Financial Invariants & Audit Protocol

This reference defines the ground truth rules for the Portfolio Tracker. Use these benchmarks to validate system accuracy.

## 1. Unit Invariants
- **Closure Rule**: If a fund is marked as "Closed" in the UI, units in the database MUST be exactly 0.000.
- **Precision**: DB units MUST match CAS PDF units to 3 decimal places.
- **Auxiliary Neutrality**: `STAMP_DUTY`, `STT`, and `CHARGE` transactions MUST NOT affect the unit balance.

## 2. Cost Basis Invariants (LTCG/STCG)
- **Anchor Rule**: For historical portfolios, the system injects an `OPENING_BALANCE` transaction.
  - `Anchor_Units = Statement_Units - Real_Tx_Units`
  - `Anchor_Cost = Statement_Cost - Real_Tx_Cost`
- **FIFO Discipline**: Tax calculations for sales MUST follow First-In-First-Out logic.
- **Grandfathering**: For Indian Equity funds, gains before Jan 31, 2018, MUST be exempt (cost stepped up to FMV).

## 3. Performance Invariants
- **Net Worth**: `Total_Value = Sum(Current_Units * Latest_NAV)`.
- **Absolute Return**: `(Value - Invested) / Invested`.
- **XIRR Bounds**: 
  - Valid: -100% to +500% (most cases).
  - Suspicious: > 1000% (likely data error or short duration).
- **Post-Tax Constraint**: `Post_Tax_XIRR <= Pre_Tax_XIRR` ALWAYS.

## 4. UI Consistency
- **Toggle Reactivity**: Changing the header toggle from "ABS" to "XIRR" MUST update the value of every row in the holdings table.
- **Loading State**: The Post-Tax column MUST show 50% opacity during a slab-triggered re-fetch.

## Audit "Red Flags"
| Code | Severity | Description |
|---|---|---|
| A1 | Critical | Net Worth is negative. |
| A2 | Blocker | Invested amount is 0 but units > 0 (Cost basis leak). |
| A3 | Error | Units are 0 but invested amount is significant (Basis erasure bug). |
| A4 | Warning | XIRR > 100% without short-term justification. |
