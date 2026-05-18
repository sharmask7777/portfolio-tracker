# Detailed Design: Portfolio History Engine

## Overview
The Portfolio History Engine is responsible for calculating and storing the daily historical value of a user's portfolio. This data will be used to generate interactive charts showing corpus movement over time.

## Detailed Requirements
- **Granularity**: Daily data points for the entire history.
- **Missing Data**: Use the last available NAV for weekends and holidays.
- **Range**: Default to last 3 months, but support expansion to the start of investment.
- **Storage**: PostgreSQL database for persistence of calculated snapshots and historical NAVs.
- **Trigger**: Background jobs triggered by CAS upload or scheduled nightly refresh.
- **API**: Endpoint `/portfolios/:id/history` with optional date range parameters.

## Architecture Overview
The engine consists of:
1. **History Service**: Orchestrates the calculation and retrieval.
2. **Calculation Engine**: Computes daily unit balances and valuations.
3. **Market Data Service Extension**: Fetches and caches historical NAVs from MFAPI.
4. **Background Jobs**: Triggers for periodic or event-driven updates.

## Data Models

### HistoricalNAV
Stores daily NAV for a specific asset.
```prisma
model HistoricalNAV {
  id        String   @id @default(uuid())
  amfiCode  String
  date      DateTime
  nav       Float
  createdAt DateTime @default(now())

  @@unique([amfiCode, date])
  @@index([amfiCode])
  @@index([date])
}
```

### PortfolioHistory
Stores the total valuation of a portfolio on a specific date.
```prisma
model PortfolioHistory {
  id              String    @id @default(uuid())
  portfolioId     String
  portfolio       Portfolio @relation(fields: [portfolioId], references: [id])
  date            DateTime
  value           Float
  investedAmount  Float
  createdAt       DateTime  @default(now())

  @@unique([portfolioId, date])
  @@index([portfolioId])
  @@index([date])
}
```

## Calculation Logic

### 1. Daily Unit Tracking
For each portfolio:
- Fetch all transactions across all folios.
- Group transactions by asset and date.
- Iterate from the earliest transaction date to today:
  - Update a running unit balance for each asset.
  - Store the daily balance snapshot.

### 2. Historical Valuation
For each day:
- `portfolioValue = Sum(assetUnits * assetNAV)`
- `investedAmount = Sum(assetInvested)`
- `assetNAV` is fetched from `HistoricalNAV` table or MFAPI (then cached).
- If NAV is missing for a date, use the latest preceding NAV.

## Error Handling
- **API Failures**: Retry mechanism for MFAPI calls.
- **Data Inconsistencies**: Validation to ensure balances don't drop below zero (unless short-selling, which is not supported here).
- **Timeouts**: Calculation jobs should be idempotent and support resumption from the last successfully calculated date.

## Testing Strategy
- **Unit Tests**: Test the balance tracking logic with various transaction types (SIP, Redemption, Dividend).
- **Integration Tests**: Verify MFAPI fetching and DB caching.
- **End-to-End**: Mock MFAPI responses and verify the `/history` API returns correct aggregated values.

## Appendices

### Technology Choices
- **MFAPI.in**: Reliable source for historical Indian Mutual Fund NAVs.
- **Prisma/PostgreSQL**: Efficient storage and indexing for time-series-like data.
- **node-cron**: For scheduling nightly refreshes.

### Research Findings
- MFAPI returns data in `DD-MM-YYYY` format, descending.
- Weekend NAVs are not provided; last available price is the industry standard proxy.
