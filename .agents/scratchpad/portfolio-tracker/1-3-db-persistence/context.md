# Context: Database Schema & Data Persistence

## Task Overview
Design the PostgreSQL schema and implement the persistence layer for parsed portfolio data using Prisma ORM.

## Requirements
- Schema with `User`, `Portfolio`, `Asset`, `Folio`, and `Transaction` models.
- Upsert logic for imported CAS data to prevent duplicate transactions.
- Transactional atomicity for imports.
- Basic CRUD APIs for retrieving portfolio state.

## Tech Stack
- Database: PostgreSQL (Docker).
- ORM: Prisma.
- Backend: Node.js/TypeScript.

## Existing Documentation
- `.planning/phase-1-plans/1-3-PLAN.md`: Task definition.
- `docker-compose.yml`: Database configuration.

## Implementation Paths
- `backend/prisma/schema.prisma`: Database schema.
- `backend/src/services/db.service.ts`: Prisma client initialization.
- `backend/src/services/sync.service.ts`: Logic for importing parsed JSON into DB.
- `backend/src/routes/portfolio.routes.ts`: Update to include retrieval APIs.
