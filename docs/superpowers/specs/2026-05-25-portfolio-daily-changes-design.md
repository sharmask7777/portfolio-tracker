# Portfolio Daily Changes Design

## Objective
Display the 1-Day change (both in absolute ₹ value and percentage) for the entire portfolio and for individual assets in the UI.

## Architecture & Calculation
We will calculate the daily change on-the-fly when the portfolio summary is requested, which avoids complex schema changes and naturally handles weekends/holidays where no NAV is published.

- **Current NAV:** The `liveNav` currently fetched from `MarketDataService.getLatestNAV`.
- **Previous NAV:** The most recent NAV from the `HistoricalNAV` table with a date strictly earlier than the `liveNav` date.
- **Asset Day Change:** `(liveNav - previousNav) * units`
- **Portfolio Day Change:** The sum of all asset day changes.

## Backend Components
1. **MarketDataService**
   - Implement `getPreviousNAV(amfiCode: string, beforeDate: Date)` to query the `HistoricalNAV` table.

2. **Portfolio API Route**
   - Update the portfolio summary response payload to include `dayChange` and `dayChangePercentage` at both the individual asset level and the top-level aggregate level.

## Frontend Components
1. **Portfolio Header**
   - Display the total `1-Day Change` alongside the total portfolio value.
   - Format: `+₹X (Y%)` or `-₹X (Y%)` with appropriate CSS colors (green for positive, red for negative).

2. **Asset Table / List**
   - Add a `1-Day Change` column or badge to each row displaying the individual asset's daily change.
   - Apply the same color coding logic as the header.
