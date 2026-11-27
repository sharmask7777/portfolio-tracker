# Context: Initial Visual Dashboard (MVP)

## Task Overview
Build the frontend dashboard for the Portfolio Tracker using React and Vanilla CSS. The dashboard will consume the `/api/portfolio/summary` and `/api/portfolio/upload` endpoints.

## Requirements
- Summary statistics (Net Worth, Gain/Loss, XIRR).
- Interactive charts (Portfolio Value vs. Invested Capital).
- Holdings table with performance metrics.
- File upload component for CAMS CAS PDF.
- Dark/Light mode support.
- Data-dense, professional "SaaS" aesthetic.

## Tech Stack
- Frontend: React, TypeScript, Vite.
- Styling: Vanilla CSS.
- Charts: Recharts.
- Icons: Lucide React.
- API Client: Axios.

## Existing Documentation
- `.planning/phase-1-plans/1-5-PLAN.md`: Task definition.

## Implementation Paths
- `frontend/src/components/Dashboard/`: Main dashboard components.
- `frontend/src/components/Upload/`: CAS upload component.
- `frontend/src/App.tsx`: Main entry point and layout.
- `frontend/src/index.css`: Global styles and theme variables.
