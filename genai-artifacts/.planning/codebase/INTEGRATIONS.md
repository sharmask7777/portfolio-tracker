# External Integrations

**Analysis Date:** 2025-02-13

## APIs & External Services

**Market Data (Mutual Funds):**
- MFAPI (https://api.mfapi.in/mf) - Used for fetching the latest Net Asset Value (NAV) for mutual funds.
  - SDK/Client: `axios`
  - Auth: None (Public API)

**Portfolio Analytics:**
- FinAPI (https://finapi.upvaly.com/api/mf) - Used for fetching underlying portfolio holdings and sector breakdown for mutual funds.
  - SDK/Client: `axios`
  - Auth: None (Public API)

**Commodity Prices:**
- Gold API (https://api.gold-api.com/api/v1/gold) - Used for fetching the latest gold price per gram.
  - SDK/Client: `axios`
  - Auth: None (Public API)

## Data Storage

**Databases:**
- PostgreSQL (Self-hosted via Docker)
  - Connection: `DATABASE_URL` env var
  - Client: Prisma ORM (`@prisma/client`)

**File Storage:**
- Local filesystem - Used for temporary storage of uploaded CAS files via `multer` (`backend/uploads/`).

**Caching:**
- Redis (Self-hosted via Docker)
  - Connection: `REDIS_HOST` and `REDIS_PORT` env vars
  - Client: `ioredis`

## Authentication & Identity

**Auth Provider:**
- Custom / Mocked (MVP State)
  - Implementation: User records are stored in PostgreSQL (`User` model in `schema.prisma`). Currently mocked in `backend/src/services/sync.service.ts` to auto-create users for portfolio synchronization.

## Monitoring & Observability

**Error Tracking:**
- None (Standard error handling with `try-catch` blocks and console logging).

**Logs:**
- `morgan` middleware for HTTP request logging in development.

## CI/CD & Deployment

**Hosting:**
- Docker-ready - Prepared for containerized deployment via `docker-compose.yml`.

**CI Pipeline:**
- Not explicitly configured in the codebase (no `.github/workflows` or similar detected).

## Environment Configuration

**Required env vars:**
- `DATABASE_URL`: PostgreSQL connection string.
- `REDIS_HOST` / `REDIS_PORT`: Redis connection details.
- `PORT`: Backend server port (defaults to 3001).
- `VITE_API_URL`: Frontend configuration for pointing to the backend API.

**Secrets location:**
- Environment variables (managed via `.env` files locally).

## Webhooks & Callbacks

**Incoming:**
- None detected.

**Outgoing:**
- None detected.

---

*Integration audit: 2025-02-13*
