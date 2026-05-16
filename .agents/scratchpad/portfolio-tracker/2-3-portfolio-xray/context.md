# Context: Portfolio X-Ray View (Backend & Logic)

## Task Overview
Implement the analytical backend for Morningstar-style Portfolio X-Ray (Sector, Market Cap, Asset Allocation).

## Requirements
- Aggregate Sector Allocation (% in Banking, Tech, etc.)
- Aggregate Asset Allocation (% in Equity, Debt, Cash)
- Aggregate Market Cap Breakdown (% in Large, Mid, Small Cap)
- New endpoint `GET /api/portfolio/:id/xray`

## Tech Stack
- Backend: Node.js/TypeScript.
- Data: Prisma, MarketDataService.

## Existing Documentation
- `.planning/phase-2-plans/2-3-PLAN.md`: Task definition.
- `backend/src/services/market-data.service.ts`: To fetch sector/cap data.

## Implementation Paths
- `backend/src/services/xray.service.ts`: Core aggregation logic.
- `backend/src/routes/portfolio.routes.ts`: New endpoint.
