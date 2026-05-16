# Plan: Market Data Integration (NAV & Holdings)

## Test Strategy
- **Unit Tests**:
    - Mock axios to test `MarketDataService` with sample responses from MFAPI and FinAPI.
    - Test `CacheService` with a mock Redis client.
- **Integration Tests**:
    - Verify that `MarketDataService` correctly fetches and caches data.
    - Verify that `nav-refresh.job` correctly iterates through assets and updates NAVs.

## Implementation Plan
1.  **Cache Service (`backend/src/services/cache.service.ts`)**:
    - Initialize `ioredis` client.
    - Implement `get<T>(key: string): Promise<T | null>`.
    - Implement `set(key: string, value: any, ttlSeconds: number): Promise<void>`.
2.  **Market Data Service (`backend/src/services/market-data.service.ts`)**:
    - Implement `getLatestNAV(amfiCode: string): Promise<number>`.
    - Implement `getHoldings(isin: string): Promise<any>`.
    - Logic: Check cache first -> Fetch from API -> Update cache -> Return.
3.  **NAV Refresh Job (`backend/src/jobs/nav-refresh.job.ts`)**:
    - Define a cron job that runs daily at midnight.
    - Fetch all unique AMFI codes from the `Asset` table.
    - Fetch latest NAV for each and update the cache/database (if needed for historical tracking).
4.  **Integration**:
    - Initialize the cron job in `backend/src/index.ts`.
    - Update `portfolio.routes.ts` to use real-time NAVs from `MarketDataService` instead of mock values from the last transaction.
