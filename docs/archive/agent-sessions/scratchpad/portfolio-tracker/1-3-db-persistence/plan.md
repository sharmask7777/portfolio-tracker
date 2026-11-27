# Plan: Database Schema & Data Persistence

## Test Strategy
- **Schema Validation**: Run `npx prisma validate`.
- **Sync Logic Test**:
    - Import a sample JSON.
    - Verify counts in `Asset`, `Folio`, and `Transaction` tables.
    - Re-import the same JSON and verify no duplicates are created (idempotency).
- **API Test**:
    - `GET /api/portfolio/summary`: Verify it returns aggregated data from the DB.

## Implementation Plan
1.  **Define Schema (`backend/prisma/schema.prisma`)**:
    - `User`: Basic info.
    - `Portfolio`: Linked to User.
    - `Asset`: Master data for Mutual Funds/Stocks. Unique by ISIN/Symbol.
    - `Folio`: Linked to Portfolio and Asset.
    - `Transaction`: Linked to Folio. Unique by date, type, amount, and balance to handle duplicates.
2.  **Database Connection**:
    - Update `backend/.env` with local PostgreSQL URL.
    - Generate Prisma Client.
3.  **Sync Service (`backend/src/services/sync.service.ts`)**:
    - Implement `syncPortfolio(userId, parsedData)`.
    - Use `prisma.$transaction` for atomicity.
    - Loop through folios and transactions from `casparser` JSON.
4.  **Route Integration**:
    - Update `portfolio.routes.ts` to call `SyncService` after parsing.
    - Add `GET /summary` route.
