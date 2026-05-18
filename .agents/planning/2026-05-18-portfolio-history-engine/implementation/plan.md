# Implementation Plan: Portfolio History Engine

## Checklist
- [x] Step 1: Schema Updates
- [x] Step 2: Historical NAV Service & Cache
- [x] Step 3: Portfolio History Calculation Engine
- [x] Step 4: History API Endpoint
- [x] Step 5: Background Jobs & Integration

## Implementation Steps

### Step 1: Schema Updates
**Objective**: Add `HistoricalNAV` and `PortfolioHistory` models to the Prisma schema.
**Guidance**: Update `backend/prisma/schema.prisma` with the models defined in the design document. Run `npx prisma migrate dev` to apply changes.
**Test Requirements**: Verify the tables are created in the database.
**Demo**: Successful database migration.

### Step 2: Historical NAV Service & Cache
**Objective**: Extend `MarketDataService` to fetch and cache historical NAVs.
**Guidance**: Implement `getHistoricalNAVs(amfiCode, startDate)` which fetches from MFAPI and stores in the `HistoricalNAV` table.
**Test Requirements**: Unit tests to verify correct parsing of MFAPI dates and successful DB storage/retrieval.
**Demo**: Script/test that fetches 1 year of NAVs for a fund and verifies they are saved in the DB.

### Step 3: Portfolio History Calculation Engine
**Objective**: Implement the logic to calculate daily portfolio values.
**Guidance**: Create `HistoryService` with a `calculateHistory(portfolioId)` method. It should track unit balances daily and multiply by historical NAVs.
**Test Requirements**: Comprehensive tests with mocked transactions (buy, sell, dividend) to ensure daily balances and valuations are correct.
**Demo**: Test case showing correct history for a multi-asset portfolio.

### Step 4: History API Endpoint
**Objective**: Expose the historical data via a REST endpoint.
**Guidance**: Add `GET /portfolios/:id/history` to the backend routes. Support `from` and `to` query parameters.
**Test Requirements**: Integration tests for the endpoint returning JSON data in the expected format (date, value, investedAmount).
**Demo**: `curl` request returning a time-series array.

### Step 5: Background Jobs & Integration
**Objective**: Automate the history calculation.
**Guidance**: Integrate history calculation into the CAS upload flow and create a nightly job to update the latest day's data.
**Test Requirements**: Verify that uploading a CAS triggers a background calculation job.
**Demo**: Upload a CAS and see history data populated in the DB after processing.
