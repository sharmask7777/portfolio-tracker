# Context: Portfolio Health Checks & Goal Tracking

## Task Overview
Implement a diagnostic engine to provide portfolio health insights and a tracker for financial goals.

## Requirements
- Health Check Engine:
    - Sector concentration risk (>30%).
    - Stock overlap/concentration risk.
    - Asset allocation drift.
- Goal Tracker:
    - Create/Edit goals with target amounts and dates.
    - Track progress against current portfolio value.
    - Estimate shortfalls.
- UI:
    - "Insights" sidebar or section.
    - Goal progress visualization.

## Tech Stack
- Backend: Node.js/Prisma.
- Logic: Reuse `XRayService` and `OverlapService`.
- Frontend: React/TypeScript.

## Existing Documentation
- `.planning/phase-4-plans/4-3-PLAN.md`: Task definition.

## Implementation Paths
- `backend/prisma/schema.prisma`: Add `Goal` model.
- `backend/src/services/health.service.ts`: Diagnostic logic.
- `backend/src/routes/health.routes.ts`: New endpoints.
- `frontend/src/components/Insights/`: Insights UI components.
