# Project Roadmap

## Milestone v5.0: Distribution & Persistence

## Phase 15: Production-Ready Dockerization [COMPLETED]
**Goal:** Create optimized, multi-stage Docker images for the backend and frontend.

**Plans:** 2 plans
- [x] 15-01-PLAN.md — Multi-stage Backend Dockerfile & .dockerignore
- [x] 15-02-PLAN.md — Multi-stage Frontend Dockerfile & Nginx Config

**Success Criteria:**
1. Backend image size is < 200MB.
2. Frontend assets are served correctly via Nginx inside a container.
3. No local `node_modules` or `.env` files are leaked into the images.

## Phase 16: Persistent Infrastructure [COMPLETED]
**Goal:** Implement reliable data persistence and service orchestration.

**Plans:** 2/2 plans complete
- [x] 16-01-PLAN.md — Docker Compose Refinement & Named Volumes
- [x] 16-02-PLAN.md — Healthchecks & Dependency Management

**Success Criteria:**
1. Data in PostgreSQL persists after `docker-compose down` and `docker-compose up`.
2. Services wait for the database to be healthy before starting.
3. Secrets are managed via `.env` files referenced in Docker Compose.

## Phase 17: Unified Setup & Automation
**Goal:** Simplify the onboarding process and automate database lifecycle.

**Plans:** 2 plans
- [ ] 17-01-PLAN.md — Unified environment setup script (setup.sh)
- [ ] 17-02-PLAN.md — Automatic migrations & one-command start

**Success Criteria:**
1. Running `sh setup.sh` initializes the environment correctly on macOS/Linux.
2. Database schema is automatically updated when the backend container starts.
3. A user can go from `git clone` to `dashboard` with minimal manual steps.
