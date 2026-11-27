# Context: Tax Implications Analyzer (Pre-trade)

## Task Overview
Build a pre-trade tax analyzer that allows users to simulate redemptions and see the tax impact (STCG, LTCG, Grandfathering) before executing a trade.

## Requirements
- Endpoint `POST /api/tax/simulate-sell`.
- Simulate FIFO redemption logic.
- Estimate STCG and LTCG tax in INR.
- Identify impact on grandfathered units.
- Switch Analysis: Compare cost of switching funds.

## Tech Stack
- Backend: Node.js/TypeScript.
- Logic: Reuse `TaxService` for FIFO and tax rules.

## Existing Documentation
- `.planning/phase-3-plans/3-2-PLAN.md`: Task definition.
- `backend/src/services/tax.service.ts`: Core tax engine.

## Implementation Paths
- `backend/src/services/tax-analyzer.service.ts`: Logic for simulations.
- `backend/src/routes/tax.routes.ts`: Endpoints for simulation.
