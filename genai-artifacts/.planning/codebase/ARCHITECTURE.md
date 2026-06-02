<!-- refreshed: 2025-02-14 -->
# Architecture

**Analysis Date:** 2025-02-14

## System Overview

```text
┌─────────────────────────────────────────────────────────────┐
│                      Frontend (React + Vite)                │
├──────────────────┬──────────────────┬───────────────────────┤
│   Analytics      │   Tax/Harvesting │    Dashboard/Family   │
│`src/components/A`│`src/components/T`│  `src/components/D`   │
└────────┬─────────┴────────┬─────────┴──────────┬────────────┘
         │                  │                     │
         ▼                  ▼                     ▼
┌─────────────────────────────────────────────────────────────┐
│                    Backend (Express API)                    │
│         `backend/src/routes`                                │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│                    Business Logic Layer                     │
│         `backend/src/services`                               │
└─────────────────────────────────────────────────────────────┘
         │                  │                     │
         ▼                  ▼                     ▼
┌─────────────────┐  ┌───────────────┐  ┌─────────────────────┐
│  Prisma/Postgres│  │ Python Parser │  │  External APIs      │
│ `prisma/schema` │  │`scripts/parse`│  │ (AMFI/Market Data)  │
└─────────────────┘  └───────────────┘  └─────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| **API Entry** | Handles HTTP requests, CORS, and routing | `backend/src/index.ts` |
| **Portfolio Controller** | Portfolio CRUD and aggregation logic | `backend/src/routes/portfolio.routes.ts` |
| **Tax Controller** | Tax calculations and harvesting API | `backend/src/routes/tax.routes.ts` |
| **CAS Parser** | Spawns Python process to extract data from CAS PDFs | `backend/src/services/parser.service.ts` |
| **Sync Service** | Reconciles parsed data with DB state | `backend/src/services/sync.service.ts` |
| **Performance Service** | Calculates XIRR, CAGR, and total gains | `backend/src/services/performance.service.ts` |
| **Market Data** | Fetches live NAVs from AMFI/External sources | `backend/src/services/market-data.service.ts` |
| **Database** | Prisma client instance for DB access | `backend/src/services/db.service.ts` |
| **UI Shell** | Main dashboard container and state management | `frontend/src/App.tsx` |

## Pattern Overview

**Overall:** Monorepo with Layered Backend and Component-based Frontend.

**Key Characteristics:**
- **Separation of Concerns:** Business logic is strictly in services; routes only handle I/O.
- **Micro-service-ish Scripts:** Uses Python for heavy lifting PDF parsing via child processes.
- **Reactive UI:** Frontend uses a single-page architecture with state-driven view switching.

## Layers

**API Layer:**
- Purpose: Exposes RESTful endpoints for the frontend.
- Location: `backend/src/routes`
- Contains: Express routers and request handlers.
- Depends on: Service Layer.
- Used by: Frontend.

**Service Layer:**
- Purpose: Contains all business logic and external integrations.
- Location: `backend/src/services`
- Contains: Classes/functions for performance, tax, sync, etc.
- Depends on: Data Access Layer (Prisma), External Scripts, External APIs.
- Used by: API Layer, Background Jobs.

**Data Access Layer:**
- Purpose: Interface with the PostgreSQL database.
- Location: `backend/prisma/` and `backend/src/services/db.service.ts`.
- Contains: Prisma schema and client.
- Depends on: PostgreSQL.
- Used by: Service Layer.

## Data Flow

### CAS Upload Path

1. **Upload Request:** User uploads a PDF via `frontend/src/App.tsx`.
2. **API Receipt:** `backend/src/routes/portfolio.routes.ts` receives the file via `multer`.
3. **Parsing:** `backend/src/services/parser.service.ts` spawns `backend/scripts/parse_cas.py` to extract JSON.
4. **Syncing:** `backend/src/services/sync.service.ts` persists assets, folios, and transactions to DB via Prisma.
5. **Enrichment:** `backend/src/routes/portfolio.routes.ts` calculates initial metrics and returns status.

### Performance Tracking Path

1. **Dashboard Load:** `frontend/src/App.tsx` calls `/api/portfolio/summary`.
2. **Aggregation:** `backend/src/routes/portfolio.routes.ts` fetches data from DB.
3. **Live Prices:** `backend/src/services/market-data.service.ts` fetches latest NAVs.
4. **Metric Calc:** `backend/src/services/performance.service.ts` computes XIRR/CAGR.
5. **Render:** Frontend displays charts using `recharts`.

## Key Abstractions

**Service Singleton:**
- Purpose: Centralized logic for specific domains.
- Examples: `backend/src/services/tax.service.ts`, `backend/src/services/performance.service.ts`.
- Pattern: Static class methods or exported instances.

## Entry Points

**Backend API:**
- Location: `backend/src/index.ts`
- Triggers: HTTP requests.
- Responsibilities: Server bootstrap, middleware, route registration.

**Frontend UI:**
- Location: `frontend/src/main.tsx`
- Triggers: Browser page load.
- Responsibilities: React DOM mounting, Global styles.

## Architectural Constraints

- **Single Database:** All modules share the same PostgreSQL instance.
- **Stateless API:** No session state in backend; authentication (if present) is expected via tokens (currently mock-user-123 pattern).
- **Synchronous Parsing:** Parsing is currently a blocking call in the route handler (child process await).

## Error Handling

**Strategy:** Try-catch blocks in routes with 500 status returns.

**Patterns:**
- **Route Error Wrapper:** Catches service errors and returns JSON error messages.
- **Python Stderr:** Captures Python script errors and translates them to JS Errors in `parser.service.ts`.

## Cross-Cutting Concerns

**Logging:** Morgan for HTTP logging in `backend/src/index.ts`.
**Persistence:** Prisma ORM for data consistency.
**Styling:** CSS variables for theme support in `frontend/src/index.css`.

---

*Architecture analysis: 2025-02-14*
