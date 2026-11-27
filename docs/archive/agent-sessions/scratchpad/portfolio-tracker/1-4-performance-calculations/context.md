# Context: Core Performance Calculations (XIRR/CAGR)

## Task Overview
Implement a service to calculate financial performance metrics (XIRR, CAGR, Absolute Return) for portfolios, folios, and assets.

## Requirements
- Calculate XIRR for irregular cash flows.
- Calculate CAGR for point-to-point performance.
- Calculate Absolute Return.
- Support different time horizons (1Y, 3Y, 5Y, All).
- Support aggregation levels: Asset, Folio, Portfolio.

## Tech Stack
- Backend: Express (Node.js/TypeScript).
- Logic: `xirr` library for IRR calculations.
- Data: Prisma for transaction retrieval.

## Existing Documentation
- `.planning/phase-1-plans/1-4-PLAN.md`: Task definition.

## Implementation Paths
- `backend/src/services/performance.service.ts`: Core calculation logic.
- `backend/src/routes/portfolio.routes.ts`: Update to include performance metrics in summary or dedicated endpoint.
