# Milestone v5.0 Requirements: Distribution & Persistence

## Distribution & Packaging
- [ ] **DIST-01**: Multi-stage Backend Dockerfile (Production-optimized Node.js)
- [ ] **DIST-02**: Multi-stage Frontend Dockerfile (Static assets served via Nginx)
- [ ] **DIST-03**: Unified `docker-compose.yml` for local production-like environment
- [ ] **DIST-04**: `.dockerignore` files for backend/frontend to exclude local artifacts

## Persistence & Security
- [ ] **PERS-01**: Persistent Named Docker Volume for PostgreSQL data (`/var/lib/postgresql/data`)
- [ ] **PERS-02**: Postgres Healthcheck in Docker Compose for service dependency management
- [ ] **PERS-03**: Support for `.env` files in Docker Compose to handle secrets securely

## Setup & DX
- [ ] **DX-01**: Cross-platform `setup.sh` script to handle environment initialization
- [ ] **DX-02**: Automatic database migrations on container startup

## Traceability
| Req ID | Phase |
|--------|-------|
| DIST-01| Phase 15 |
| DIST-02| Phase 15 |
| DIST-03| Phase 15 |
| DIST-04| Phase 15 |
| PERS-01| Phase 16 |
| PERS-02| Phase 16 |
| PERS-03| Phase 16 |
| DX-01  | Phase 17 |
| DX-02  | Phase 17 |
