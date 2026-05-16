# Phase 2, Task 1: Market Data Integration (NAV & Holdings)

## Objective
Integrate external APIs to fetch real-time NAVs and underlying portfolio holdings for mutual funds.

## Given
*   Backend (Node.js/TypeScript) with Prisma.
*   `Asset` table containing ISINs and AMFI codes.

## When
1.  Implement a `MarketDataService` in the backend.
2.  Integrate `MFAPI.in` for fetching the latest NAVs for all AMFI codes in the database.
3.  Integrate `FinAPI (Upvaly)` to fetch detailed portfolio holdings (stocks, weights) and sector breakdowns for each ISIN.
4.  Implement a caching layer (using Redis, as already in `docker-compose.yml`) to store market data for 24 hours to minimize API calls.
5.  Create a scheduled job (using `node-cron`) to refresh NAVs daily.

## Then
*   The system should have access to current market prices and underlying stock components for all mutual funds in the user's portfolio.
*   Market data should be cached to ensure fast dashboard load times.
