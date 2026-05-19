# Codebase Structure

**Analysis Date:** 2025-02-14

## Directory Layout

```
[project-root]/
├── backend/            # Express Node.js Backend
│   ├── prisma/         # DB Schema and Migrations
│   ├── scripts/        # Python parsing and utility scripts
│   ├── src/            # TypeScript Source
│   │   ├── jobs/       # Background/Cron jobs
│   │   ├── routes/     # Express route handlers
│   │   ├── services/   # Business logic
│   │   └── utils/      # Shared helpers
│   └── test-utils/     # Mock generators for testing
├── frontend/           # React + Vite Frontend
│   ├── public/         # Static assets
│   └── src/            # TypeScript/React Source
│       ├── assets/     # Images and SVG
│       └── components/ # React components (domain-grouped)
├── strands-skills/     # GSD Skill definitions
└── .planning/          # GSD planning and codebase documentation
```

## Directory Purposes

**backend/src/services:**
- Purpose: Core logic and external integrations.
- Contains: `tax.service.ts`, `performance.service.ts`, `market-data.service.ts`, etc.
- Key files: `db.service.ts` (Prisma client).

**backend/src/routes:**
- Purpose: API surface.
- Contains: `portfolio.routes.ts`, `tax.routes.ts`, etc.
- Key files: `index.ts` (Server entry).

**frontend/src/components:**
- Purpose: UI components grouped by feature.
- Contains: `Analytics/`, `Tax/`, `Dashboard/`, `Family/`, `Insights/`.
- Key files: `XRayView.tsx`, `TaxView.tsx`.

## Key File Locations

**Entry Points:**
- `backend/src/index.ts`: Backend server start.
- `frontend/src/main.tsx`: Frontend React entry.

**Configuration:**
- `backend/prisma/schema.prisma`: Database schema.
- `package.json`: Project dependencies and scripts.
- `backend/tsconfig.json`: Backend TS config.
- `frontend/vite.config.ts`: Frontend build config.

**Core Logic:**
- `backend/src/services/performance.service.ts`: Portfolio math.
- `backend/scripts/parse_cas.py`: PDF extraction logic.

**Testing:**
- `backend/src/services/*.spec.ts`: Unit and integration tests.
- `backend/test-utils/MockCASGenerator.ts`: Test data factory.

## Naming Conventions

**Files:**
- Backend: `name.service.ts`, `name.routes.ts`, `name.spec.ts` (kebab-case).
- Frontend: `ComponentName.tsx` (PascalCase), `name.css` (kebab-case).

**Directories:**
- Kebab-case: `test-utils`, `family-manager`.

## Where to Add New Code

**New Feature (e.g., Reports):**
- Backend Service: `backend/src/services/report.service.ts`
- Backend Route: `backend/src/routes/report.routes.ts`
- Frontend Component: `frontend/src/components/Reports/ReportView.tsx`

**New Utility:**
- Shared helper: `backend/src/utils/` or `frontend/src/utils/` (if created).

**New Database Model:**
- Schema change: `backend/prisma/schema.prisma`
- Migration: `npx prisma migrate dev`

## Special Directories

**backend/uploads:**
- Purpose: Temporary storage for uploaded CAS PDFs.
- Generated: Yes (by `multer`).
- Committed: No (in `.gitignore`).

---

*Structure analysis: 2025-02-14*
