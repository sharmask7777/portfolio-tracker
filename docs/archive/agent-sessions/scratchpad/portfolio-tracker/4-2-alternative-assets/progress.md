# Progress: Alternative Assets (EPF, PPF, SGB, Gold)

## Status
- [x] Update Prisma Schema (AssetType enums)
- [x] Implement Alternative Asset Service (EPF/PPF Logic)
- [x] Implement Gold Price Fetching
- [x] Create Manual Asset Entry API
- [x] Build AddAssetModal UI (Frontend)
- [x] Update Portfolio X-Ray for Alternative Assets
- [x] Write Unit Tests for Alternative Assets

## Setup Notes
- Mode: Auto
- Documentation Dir: `.agents/scratchpad/portfolio-tracker/4-2-alternative-assets/`

## Implementation Log
- **2026-05-16**: Initialized documentation and research.
- **2026-05-16**: Expanded `AssetType` with `EPF`, `PPF`, `SGB`, `PHYSICAL_GOLD`.
- **2026-05-16**: Implemented `AlternativeAssetService` for interest and gold price calculations.
- **2026-05-16**: Added `POST /api/portfolio/manual-asset` for non-CAS asset tracking.
- **2026-05-16**: Built `AddAssetModal` component and integrated it into the header.
- **2026-05-16**: Updated `XRayService` to include alternative assets in the asset allocation breakdown.
- **2026-05-16**: Verified implementation with new unit tests and fixed existing X-Ray test mocks.
