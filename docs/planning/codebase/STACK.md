# Technology Stack

**Analysis Date:** 2025-02-13

## Languages

**Primary:**
- TypeScript 6.0 - Used for both Backend (`backend/src/`) and Frontend (`frontend/src/`) development.

**Secondary:**
- Python - Used for Consolidated Account Statement (CAS) parsing scripts (`backend/scripts/parse_cas.py`).

## Runtime

**Environment:**
- Node.js - Primary execution environment for backend and frontend tooling.
- Docker - Infrastructure management using `docker-compose.yml` for PostgreSQL and Redis.

**Package Manager:**
- npm - Used across the workspace.
- Lockfile: `package-lock.json` present in root, `backend/`, and `frontend/`.

## Frameworks

**Core:**
- Express 5.2.1 - Backend web framework (`backend/package.json`).
- React 19.2.6 - Frontend UI library (`frontend/package.json`).
- Prisma 7.8.0 - ORM for database interactions (`backend/prisma/schema.prisma`).

**Testing:**
- Jest 30.4.2 - Primary testing runner (`backend/package.json`).
- Fast-check 4.8.0 - Property-based testing library used for robustness verification.
- @faker-js/faker - Synthetic data generation for tests.

**Build/Dev:**
- Vite 8.0.12 - Frontend build tool and dev server (`frontend/vite.config.ts`).
- Concurrently 9.2.1 - Task runner for simultaneous backend/frontend development (`package.json`).
- ts-node-dev - Backend development with auto-reload.

## Key Dependencies

**Critical:**
- Axios 1.16.1 - Promise-based HTTP client for API requests in both backend and frontend.
- node-irr 2.0.5 - Library for calculating Internal Rate of Return (IRR) for portfolios.
- Recharts 3.8.1 - Composable charting library for the frontend dashboard.
- casparser - Python library used for parsing CAS PDF/JSON data.

**Infrastructure:**
- ioredis 5.10.1 - Robust Redis client for Node.js.
- pg 8.20.0 - PostgreSQL client for Node.js.
- Helmet 8.1.0 - Security middleware for Express.
- Multer 2.1.1 - Middleware for handling `multipart/form-data` (file uploads).

## Configuration

**Environment:**
- Configured via `.env` files using `dotenv`.
- Key configs include `DATABASE_URL`, `REDIS_HOST`, `REDIS_PORT`, and `PORT`.

**Build:**
- `backend/tsconfig.json` - TypeScript configuration for the server.
- `frontend/vite.config.ts` - Vite configuration for the React application.
- `backend/prisma/schema.prisma` - Database schema definition.

## Platform Requirements

**Development:**
- Node.js & npm
- Docker & Docker Compose (for database and cache)
- Python 3.x (for CAS parsing capabilities)

**Production:**
- Docker-ready hosting environment (infrastructure defined in `docker-compose.yml`).

---

*Stack analysis: 2025-02-13*
