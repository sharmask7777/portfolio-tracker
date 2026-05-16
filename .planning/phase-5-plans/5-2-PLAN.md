# Phase 5, Task 2: Property-Based Testing (PBT) Foundation

## Objective
Introduce Property-Based Testing to the backend to automatically verify invariants across millions of generated inputs.

## Given
*   Jest testing framework already in place.
*   `MockCASGenerator` from Task 5.1.

## When
1.  Install `fast-check` library.
2.  Set up custom `fast-check` Arbitraries for Portfolio Data (Transactions, Lots, Asset Types).
3.  Configure Jest to run PBT suites efficiently alongside standard unit tests.

## Then
*   The project is equipped with the tools necessary to perform institutional-grade mathematical verification.
