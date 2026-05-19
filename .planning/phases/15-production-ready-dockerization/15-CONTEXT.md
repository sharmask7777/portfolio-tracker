# Phase 15: Production-Ready Dockerization - Context

**Gathered:** 2026-05-19
**Status:** Ready for planning
**Mode:** Smart Discuss (Autonomous)

<domain>
## Phase Boundary

The goal of this phase is to move from development-heavy Docker images to optimized, multi-stage production images. This includes:
- Backend: Multi-stage build for Node.js (Prisma/TypeScript), running as a non-root user.
- Frontend: Multi-stage build for React (Vite), serving static assets via Nginx.
- Security: Implementing strict `.dockerignore` rules.
- Configuration: Ensuring the application is environment-driven.

</domain>

<decisions>
## Implementation Decisions

| Area | Decision | Rationale |
|---|---|---|
| **Base Images** | `node:20-alpine`, `nginx:stable-alpine` | Industry standard for minimal, secure production images. |
| **Backend Runtime** | Multi-stage, non-root user (`node`) | Security best practice; minimizes attack surface and prevents root exploits. |
| **Frontend Serving** | Nginx for static assets | High performance, lightweight, and standard for SPA production delivery. |
| **Exclusions** | Strict `.dockerignore` | Prevents local `node_modules`, secrets, and source code from bloating the image or leaking sensitive data. |
| **Configuration** | Environment variables | Decouples build from environment; allows same image to run in different stages (dev/staging/prod). |

</decisions>

<code_context>
## Existing Code Insights

- Backend uses Prisma; needs `npx prisma generate` during build.
- Frontend uses Vite; builds to `dist/`.
- Project currently has a `docker-compose.yml` that likely needs updates in the next phase (Phase 16).

</code_context>

<specifics>
## Specific Requirements

- Backend image must be < 200MB.
- Frontend must be served on port 80 inside the container (mapped to 5173 or 80 on host).
- `.dockerignore` must be present in both `backend/` and `frontend/` roots.

</specifics>

<deferred>
## Deferred Ideas

- Docker Volume persistence (moved to Phase 16).
- Unified setup script (moved to Phase 17).

</deferred>
