# Phase 4, Task 2: Alternative Assets (EPF, PPF, SGB, Gold)

## Objective
Expand the tracker's scope beyond Mutual Funds and Stocks to include major Indian alternative investments.

## Given
*   `AssetType` enum in the database.
*   Frontend dashboard with asset allocation charts.

## When
1.  Add new types to `AssetType`: `EPF`, `PPF`, `SGB` (Sovereign Gold Bonds), `PHYSICAL_GOLD`.
2.  Implement a manual entry interface for these assets (since they don't appear in CAMS CAS).
3.  Implement specialized logic for interest calculation (e.g., EPF/PPF annual compounding rates).
4.  Integrate SGB and Gold price fetching (e.g., via IBJA rates or gold price APIs).
5.  Update "Portfolio X-Ray" to include these alternative assets in the asset allocation breakdown.

## Then
*   The "Net Worth" card reflects the user's entire wealth, including retirement and gold holdings.
*   The dashboard provides a truly holistic view of the user's financial life.
