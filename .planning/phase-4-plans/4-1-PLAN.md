# Phase 4, Task 1: Family Accounts (Multi-PAN Consolidation)

## Objective
Implement the ability to group multiple individual portfolios into a single "Family Net Worth" view while maintaining distinct legal ownership.

## Given
*   Existing `User`, `Portfolio`, and `Folio` structure.
*   Data ingestion via CAMS CAS.

## When
1.  Extend the database schema to support `FamilyGroup` and many-to-many relationships between `Users`.
2.  Implement "Portfolio Sharing": Allow one user to invite another to share their portfolio data.
3.  Update the `GET /api/portfolio/summary` to support an optional `familyGroupId` parameter to aggregate data across all member portfolios.
4.  Update the Frontend to include a "Family View" toggle in the header/sidebar.
5.  Ensure tax calculations remain per-PAN (individual) even in aggregated views.

## Then
*   A user can see their entire family's wealth (Parents, Spouse, Children) in one dashboard.
*   The system accurately attributes assets to the original PAN holder for tax reporting.
