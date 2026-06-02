# Context: Advanced Visualizations (Frontend)

## Task Overview
Implement the "Portfolio X-Ray" and "Stock Intersection" views in the frontend.

## Requirements
- New navigation/tabs for "Overview", "X-Ray", and "Intersection".
- Sector Allocation visualization (Treemap).
- Market Cap Breakdown (Bar Chart).
- Asset Allocation (Pie Chart).
- Stock Intersection Table (Top 10 exposures).
- Integration with `/api/portfolio/:id/xray` and `/api/portfolio/:id/exposures`.

## Tech Stack
- Frontend: React (Vite/TypeScript).
- Charts: Recharts.
- Icons: Lucide React.
- Styling: Vanilla CSS.

## Existing Documentation
- `.planning/phase-2-plans/2-4-PLAN.md`: Task definition.

## Implementation Paths
- `frontend/src/components/Analytics/`: New folder for advanced charts.
- `frontend/src/App.tsx`: Main dashboard update to include tabs.
- `frontend/src/App.css`: Styles for new visualizations.
