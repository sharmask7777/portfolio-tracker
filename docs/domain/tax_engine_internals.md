# Tax Engine Internals

## FIFO Processing Mechanism
The tax engine rigorously follows the First-In-First-Out (FIFO) method for calculating capital gains on mutual fund redemptions, as mandated by Indian tax laws. Units acquired earliest are assumed to be sold first.

## Rule Implementations
- **Post-July 23, 2024 Sales:** The engine applies the new taxation rates (e.g., 12.5% for Equity LTCG) for any sales recorded after the July 23, 2024 budget announcement.
- **Grandfathering Logic:**
  - For equity units bought before Jan 31, 2018, the Cost of Acquisition is dynamically adjusted based on the closing price on Jan 31, 2018.
  - The engine determines whether to apply the grandfathered cost or the original cost to minimize tax liability, strictly following the defined rules.
