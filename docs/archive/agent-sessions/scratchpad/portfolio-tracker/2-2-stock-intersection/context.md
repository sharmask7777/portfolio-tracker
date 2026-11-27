# Context: Stock Intersection (Overlap) Engine

## Task Overview
Implement `OverlapService` to calculate overlapping stock holdings across mutual funds in a portfolio.

## Requirements
- Fetch holdings for each mutual fund in the portfolio using `MarketDataService`.
- Calculate absolute value of each stock holding.
- Aggregate stock exposures across all funds.
- Calculate overlap percentage between pairs of funds.
- Provide data for frontend visualizations.

## Tech Stack
- Backend: Express (Node.js/TypeScript).
- Data: Prisma, MarketDataService.
- Logic: Aggregation and percentage calculation.

## Existing Documentation
- `.planning/phase-2-plans/2-2-PLAN.md`: Task definition.
- `backend/src/services/market-data.service.ts`: To fetch holdings.

## Implementation Paths
- `backend/src/services/overlap.service.ts`: Core intersection logic.
- `backend/src/routes/portfolio.routes.ts`: New endpoint for overlap data.
