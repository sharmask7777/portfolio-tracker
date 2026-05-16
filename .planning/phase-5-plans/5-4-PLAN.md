# Phase 5, Task 4: PBT for Analytics & Aggregation

## Objective
Write property tests to validate the accuracy of deep analytics (X-Ray, Overlap) and Family Consolidation.

## Given
*   `XRayService`, `OverlapService`, `FamilyService`.
*   `fast-check` arbitraries.

## When
1.  **X-Ray Invariants:** Verify that the sum of percentages for Sectors, Market Cap, and Asset Allocation always equals exactly `1.0` (100%) across random portfolio constructions.
2.  **Overlap Invariants:** Verify that `OverlapPercentage(Fund A, Fund B)` is always between `0` and `100%`, and is symmetric (Overlap(A,B) == Overlap(B,A)).
3.  **Family Aggregation PBT:** Verify that `Sum(Individual Net Worths) == Family Net Worth` for randomly generated family groups with varying portfolio sizes.

## Then
*   The analytical and consolidation engines are proven to provide consistent, error-free aggregations regardless of data complexity.
