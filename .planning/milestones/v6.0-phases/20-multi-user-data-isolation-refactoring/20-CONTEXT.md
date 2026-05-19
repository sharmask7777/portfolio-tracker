# Phase 20: Multi-User Data Isolation & Refactoring - Context

**Gathered:** 2026-05-19
**Status:** Ready for planning
**Mode:** Discuss

<domain>
## Phase Boundary

Phase 20 is the final step in the multi-user rollout. It enforces the security boundaries implemented in Phase 18 and integrated in Phase 19. It removes the "mock" safety net, ensuring that users can only access data belonging to their specific account.

</domain>

<decisions>
## Implementation Decisions

| Area | Decision | Rationale |
|---|---|---|
| **Identity Source** | `req.user.id` | The JWT middleware (Phase 18) is now the single source of truth for user identity. |
| **Route Protection** | Universal `authMiddleware` | All data-bearing routes must be protected. No public access to portfolio data. |
| **Data Scope** | Primary Key Isolation | Every Prisma query will include a `userId` filter at the highest possible level. |
| **Mock Removal** | Absolute Deletion | References to `mock-user-123` will be completely purged from the codebase. |

</decisions>

<code_context>
## Existing Code Insights

- **Current Fallbacks:** `const { userId = 'mock-user-123' } = req.query;` is ubiquitous in the routes.
- **Service Layer:** Services already accept `userId` as a parameter, so the refactor is mostly at the controller/route level.
- **Frontend State:** Frontend is already sending the token, so it's ready for the backend to start enforcing it.

</code_context>

<specifics>
## Specific Requirements

- **Middleware Application:** Apply `authMiddleware` to all routes in `portfolio`, `tax`, `health`, and `family`.
- **Query Refactoring:** Ensure `req.user.id` is used everywhere.
- **Error Handling:** 401 Unauthorized should be handled gracefully (Frontend already handles this via interceptor).

</specifics>

<deferred>
## Deferred Ideas

- **Role-Based Access Control (RBAC):** Postponed until admin or specialized roles are needed.
- **Audit Logging:** To be considered in a future security-focused milestone.

</deferred>
