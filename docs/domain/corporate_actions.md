# Corporate Actions

## Overview
Accurate portfolio valuation requires robust handling of corporate actions within mutual fund schemes.

## Bonus Units
- **Handling:** Bonus units issued by AMCs are recorded with a Net Asset Value (NAV) of `0`. The transaction parser identifies these entries and adjusts the total unit balance without impacting the invested capital.

## Splits and Missing Histories
- **Treatment of Splits:** When a scheme undergoes a stock split or a face value change, historical units and NAVs must be adjusted proportionally. The domain logic incorporates split multipliers for accurate historical XIRR calculations.
- **Missing Histories:** If a scheme's NAV history is temporarily unavailable from `mfapi.in`, the system attempts to interpolate or maintain the last known NAV to prevent sudden drops in portfolio valuation.
