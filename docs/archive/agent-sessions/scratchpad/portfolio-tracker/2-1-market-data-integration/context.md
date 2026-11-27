# Context: Market Data Integration (NAV & Holdings)

## Task Overview
Implement `MarketDataService` to fetch and cache NAVs and portfolio holdings for mutual funds using MFAPI.in and FinAPI (Upvaly).

## Requirements
- `MarketDataService` with methods to fetch NAV and holdings.
- Redis integration for caching market data (24h TTL).
- Scheduled job using `node-cron` for daily NAV updates.
- Integration with existing `Asset` and `Folio` data.

## Tech Stack
- Backend: Express (Node.js/TypeScript).
- Cache: Redis (ioredis).
- Job Scheduling: node-cron.
- APIs: MFAPI.in, FinAPI (Upvaly).

## Existing Documentation
- `.planning/phase-2-plans/2-1-PLAN.md`: Task definition.
- `docker-compose.yml`: Redis configuration.

## Implementation Paths
- `backend/src/services/market-data.service.ts`: Core integration logic.
- `backend/src/services/cache.service.ts`: Redis wrapper.
- `backend/src/jobs/nav-refresh.job.ts`: Scheduled task.
- `backend/src/services/db.service.ts`: Database interactions.
