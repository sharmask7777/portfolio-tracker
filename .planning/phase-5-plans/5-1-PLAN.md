# Phase 5, Task 1: Synthetic CAS Data Generation Engine

## Objective
Build a robust engine to generate thousands of diverse, realistic CAMS/KFintech CAS JSON statements for stress-testing the system.

## Given
*   Node.js/TypeScript environment.
*   Knowledge of standard `casparser` JSON schema.

## When
1.  Install `@faker-js/faker` as a dev dependency.
2.  Implement `MockCASGenerator` in `backend/test-utils/`.
3.  Support edge cases:
    *   `DIVIDEND_REINVESTMENT` and `SWITCH_IN`/`SWITCH_OUT`.
    *   `BONUS` units (0 cost).
    *   Extreme values (very small units, very large NAVs).
    *   Highly volatile cash flows for XIRR stress testing.
4.  Generate portfolios with varying complexity (single fund, massive multi-family, high overlap).

## Then
*   The test suite has access to a limitless supply of valid and edge-case CAS data to verify logic without relying on static mocks.
