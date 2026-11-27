# Context: Alternative Assets (EPF, PPF, SGB, Gold)

## Task Overview
Expand the tracker to support non-CAS assets like EPF, PPF, Sovereign Gold Bonds, and Physical Gold.

## Requirements
- Support manual entry of asset balance and date.
- Real-time gold price integration for value calculation.
- Accurate compounding interest logic for EPF (8.25%) and PPF (7.1%).
- Holistic asset allocation view in X-Ray.

## Tech Stack
- Backend: Node.js/Prisma.
- APIs: Gold-API.com (Spot gold price).

## Existing Documentation
- `.planning/phase-4-plans/4-2-PLAN.md`: Task definition.
