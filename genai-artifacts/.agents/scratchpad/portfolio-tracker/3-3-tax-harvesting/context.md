# Context: Tax Harvesting Engine

## Task Overview
Implement a service to identify LTCG tax harvesting opportunities to utilize the ₹1.25 Lakh annual tax-exempt limit for equity gains.

## Requirements
- Calculate total realized LTCG for the current financial year (FY).
- Identify equity holdings with unrealized LTCG (>1 year holding period).
- Recommend "Sell and Buy" transactions to utilize the remaining exemption limit.
- Provide a summary of potential tax savings.

## Tech Stack
- Backend: Node.js/TypeScript.
- Logic: Reuse `TaxService` for lot identification and gain calculation.

## Existing Documentation
- `.planning/phase-3-plans/3-3-PLAN.md`: Task definition.
- `backend/src/services/tax.service.ts`: Tax calculation logic.

## Implementation Paths
- `backend/src/services/harvesting.service.ts`: Core logic for identifying opportunities.
- `backend/src/routes/tax.routes.ts`: New endpoint for harvesting recommendations.
