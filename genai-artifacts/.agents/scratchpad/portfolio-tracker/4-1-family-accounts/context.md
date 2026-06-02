# Context: Family Accounts (Multi-PAN Consolidation)

## Task Overview
Implement family grouping and multi-PAN consolidation to provide a "Family Net Worth" view while preserving individual tax data.

## Requirements
- Extend Prisma schema for `FamilyGroup` and many-to-many user relationships.
- Implementation of portfolio sharing/invitation logic.
- Aggregated summary API `GET /api/portfolio/summary?familyGroupId=...`.
- Frontend "Family View" toggle and aggregated metrics.
- Preservation of individual PAN attribution for tax logic.

## Tech Stack
- Backend: Node.js/Express/TypeScript, Prisma.
- Frontend: React/TypeScript, Recharts.

## Existing Documentation
- `.planning/phase-4-plans/4-1-PLAN.md`: Task definition.
- `backend/prisma/schema.prisma`: Current schema.

## Implementation Paths
- `backend/prisma/schema.prisma`: Schema updates.
- `backend/src/services/family.service.ts`: Logic for family management.
- `backend/src/routes/family.routes.ts`: Family management endpoints.
- `frontend/src/components/Family/`: Family management UI.
