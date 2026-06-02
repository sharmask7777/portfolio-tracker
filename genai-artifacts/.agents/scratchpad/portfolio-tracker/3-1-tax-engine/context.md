# Context: Core Tax Calculation Engine (FIFO & Grandfathering)

## Task Overview
Implement a service to calculate realized and unrealized capital gains for Indian mutual funds and stocks using FIFO (First-In-First-Out) logic and handling complex tax rules (Grandfathering, Slab rates).

## Requirements
- FIFO matching for redemptions.
- STCG vs LTCG classification based on holding periods.
- Handle equity grandfathering (Jan 31, 2018 price rule).
- Handle debt mutual fund tax changes (post-April 2023).
- Calculate realized gains for past redemptions.
- Calculate unrealized gains for current holdings.

## Tech Stack
- Backend: Node.js/TypeScript.
- Data: Prisma for transaction retrieval.

## Existing Documentation
- `.planning/phase-3-plans/3-1-PLAN.md`: Task definition.

## Implementation Paths
- `backend/src/services/tax.service.ts`: Core calculation logic.
- `backend/src/routes/tax.routes.ts`: Endpoints for tax summaries.
