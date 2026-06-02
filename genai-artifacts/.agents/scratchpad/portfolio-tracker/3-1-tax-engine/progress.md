# Progress: Core Tax Calculation Engine (FIFO & Grandfathering)

## Status
- [x] Implement FIFO Matching Logic
- [x] Implement Capital Gains Classification (STCG/LTCG)
- [x] Implement Grandfathering Logic (Equity)
- [x] Implement Debt Fund Tax Logic (Basic)
- [x] Implement Unrealized Gains Calculation
- [x] Create Tax API Endpoints
- [x] Write Unit Tests for Tax Logic

## Setup Notes
- Mode: Auto
- Documentation Dir: `.agents/scratchpad/portfolio-tracker/3-1-tax-engine/`

## Implementation Log
- **2026-05-16**: Initialized documentation and research.
- **2026-05-16**: Implemented `TaxService` with FIFO matching and Indian tax rules (STCG/LTCG).
- **2026-05-16**: Added Grandfathering logic for Jan 31, 2018 prices.
- **2026-05-16**: Added `GET /api/portfolio/:id/tax-summary` endpoint for aggregated gains data.
- **2026-05-16**: Verified implementation with a comprehensive test suite in `tax.service.spec.ts`.
