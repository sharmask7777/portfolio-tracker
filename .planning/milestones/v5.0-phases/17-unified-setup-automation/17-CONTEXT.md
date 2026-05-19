# Phase 17: Unified Setup & Automation - Context

**Gathered:** 2026-05-19
**Status:** Ready for planning
**Mode:** Smart Discuss (Autonomous)

<domain>
## Phase Boundary

The final phase of Milestone v5.0 focuses on the Developer Experience (DX) and user onboarding. We need a single entry point for setting up the entire environment, whether for local development or for production-ready consumption via Docker.

</domain>

<decisions>
## Implementation Decisions

| Area | Decision | Rationale |
|---|---|---|
| **Setup Entry Point** | `setup.sh` (bash) | Unified script for environment initialization, .env setup, and pre-flight checks. |
| **Migrations** | `prisma migrate deploy` on backend start | Ensures the database schema is always up-to-date with the code version running in the container. |
| **Local Dev Support** | venv and local npm setup in `setup.sh` | Supports the user's preference for local venv-based setup while still providing the Docker option. |
| **Automation** | One-command build and start | Reduces friction for new users/developers. |

</decisions>

<code_context>
## Existing Code Insights

- `setup_worktree.sh` exists but is for a different purpose (agent worktrees).
- Backend needs `DATABASE_URL` for migrations.
- We need to handle both `docker-compose` and local `npm install`.

</code_context>

<specifics>
## Specific Requirements

- `setup.sh` must be runnable on macOS/Linux.
- `setup.sh` should handle `.env` creation from `.env.example`.
- Backend Dockerfile CMD should be updated to run migrations.

</specifics>

<deferred>
## Deferred Ideas

- Windows-native `setup.bat` (can be added if requested later).

</deferred>
