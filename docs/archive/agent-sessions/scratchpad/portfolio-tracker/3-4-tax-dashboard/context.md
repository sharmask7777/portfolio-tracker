# Context: Tax Dashboard & ITR Reporting

## Task Overview
Implement a dedicated "Tax" view in the frontend to visualize realized/unrealized gains, track LTCG exemptions, and offer pre-trade simulations and harvesting recommendations.

## Requirements
- New "Tax" tab in navigation.
- LTCG Exemption Progress Bar (Target: ₹1.25L).
- Realized Gains Summary Table.
- Tax Harvesting Recommendation widget.
- Pre-trade Simulation modal/sidebar.
- Export Capital Gains Report (CSV).

## Tech Stack
- Frontend: React, Recharts, Lucide Icons.
- Backend: `taxRoutes` already implemented.

## Existing Documentation
- `.planning/phase-3-plans/3-4-PLAN.md`: Task definition.
- `backend/src/routes/tax.routes.ts`: Backend endpoints.

## Implementation Paths
- `frontend/src/components/Tax/`: New components for tax visualization.
- `frontend/src/App.tsx`: Tab integration.
- `frontend/src/App.css`: Tax-specific styles.
