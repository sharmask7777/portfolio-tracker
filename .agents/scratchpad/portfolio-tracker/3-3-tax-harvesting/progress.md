# Progress: Tax Harvesting Engine

## Status
- [x] Implement Harvesting Service
- [x] Calculate FY Realized LTCG
- [x] Scan Unrealized LTCG Opportunities
- [x] Generate Harvesting Recommendations
- [x] Create Harvesting API Endpoint
- [x] Write Unit Tests for Harvesting Service

## Setup Notes
- Mode: Auto
- Documentation Dir: `.agents/scratchpad/portfolio-tracker/3-3-tax-harvesting/`

## Implementation Log
- **2026-05-16**: Initialized documentation and research.
- **2026-05-16**: Implemented `HarvestingService` with FY-aware realized LTCG calculation and exemption tracking.
- **2026-05-16**: Added scanning logic for unrealized LTCG lots (> 1 year) in equity holdings.
- **2026-05-16**: Created `GET /api/tax/harvesting-opportunities` endpoint.
- **2026-05-16**: Verified harvesting logic with unit tests.
