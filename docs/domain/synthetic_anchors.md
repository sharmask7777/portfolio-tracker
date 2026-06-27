# Synthetic Anchors

## Generation of Synthetic OPENING_BALANCE
When a user uploads a CAS statement for a specific date range, the statement often begins with an `OPENING_BALANCE` without the detailed historical transaction logs that led to that balance. To make the portfolio functional, the system generates a synthetic "Anchor" transaction.

## Assumptions for Missing Data
Because the exact acquisition date and price of the opening balance units are unknown, the system must make assumptions to calculate estimated returns and taxes:
- **Equity Returns:** Assumes a historical annualized return of **12%** to reverse-calculate a plausible acquisition price and date.
- **Debt Returns:** Assumes a historical annualized return of **7%** for debt instruments.
*(Note: These are estimations and carry inherent tax calculation risks, which are documented in the risks section).*
