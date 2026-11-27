# Research: Portfolio History Calculation

To calculate the historical value of a portfolio daily:

## Algorithm

1. **Identify Start Date**: The date of the first transaction across all assets in the portfolio.
2. **Asset Balance Tracking**:
   - For each asset, maintain a running `unitsBalance`.
   - Iterate from `startDate` to `today`.
   - For each day:
     - Apply transactions that occurred on this day to `unitsBalance`.
     - Record `(assetId, date, unitsBalance)`.
3. **Valuation**:
   - For each day from `startDate` to `today`:
     - `totalValue = 0`
     - `totalInvested = 0`
     - For each asset:
       - `units = unitsBalance[assetId][date]`
       - `nav = getHistoricalNAV(assetId, date)`
       - `totalValue += units * nav`
       - `totalInvested += getInvestedAmount(assetId, date)`
     - Store `(portfolioId, date, totalValue, totalInvested)` in `PortfolioHistory`.

## Incremental Updates
- If `PortfolioHistory` already has data up to `lastDate`, start calculation from `lastDate + 1 day`.
- Recalculate if a new CAS is uploaded that affects historical transactions.

## Database Schema
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
