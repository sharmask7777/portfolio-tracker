# Rough Idea: Portfolio History Engine

Implement backend logic to calculate and serve daily historical portfolio values.

## Core Requirements:
- Calculate unit balances for each asset on a day-by-day basis starting from the first transaction date.
- Fetch historical NAVs from MFAPI (or other sources) for these dates.
- Compute daily portfolio values (Units * NAV).
- Support for multiple assets (Mutual Funds primarily).
- Implement an API endpoint `/portfolios/:id/history` to serve this data.
- Caching strategy to avoid repeated calculations and expensive API calls.
