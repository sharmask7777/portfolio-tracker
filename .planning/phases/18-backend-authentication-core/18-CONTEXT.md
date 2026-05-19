# Phase 18: Backend Authentication Core - Context

**Gathered:** 2026-05-19
**Status:** Ready for planning
**Mode:** Discuss

<domain>
## Phase Boundary

Phase 18 establishes the security foundation for the application. It transitions the backend from an open/mock system to one protected by identity-based access. The primary delivery is a set of auth endpoints (register/login) and a reusable `authenticate` middleware that extracts user identity from JWT tokens.

</domain>

<decisions>
## Implementation Decisions

| Area | Decision | Rationale |
|---|---|---|
| **Token Strategy** | Stateless JWT | Simple, robust, and aligns with the current scale. Avoids database overhead for every request. |
| **Registration** | Open Signup | Allows new users to create accounts without manual intervention. |
| **Password Policy** | Basic (Length focus) | Balances security with developer/user experience for the current stage. |
| **Session Control** | Simple Expiration | Sufficient for a single-user-focused portfolio tracker; revocation is not a Day 1 requirement. |
| **Hashing** | Bcrypt (12 rounds) | Industry standard for secure password storage. |
| **Identity Context** | `req.user.id` | The middleware will attach the `userId` to the Express Request object to support Phase 20's isolation work. |

</decisions>

<code_context>
## Existing Code Insights

- **Prisma Schema:** `User` model already exists with `email` and `password` fields.
- **Mock Identity:** Current routes use `userId = req.body.userId || 'mock-user-123'`.
- **Middleware:** No `src/middleware` directory exists yet; it will be created in this phase.
- **Type Safety:** Will need an `express.d.ts` in `src/types` to extend the Request interface for `req.user`.

</code_context>

<specifics>
## Specific Requirements

- **JWT Secret:** Must be managed via `JWT_SECRET` in `.env`.
- **Token Payload:** Include at least `userId` and `email`.
- **Error Handling:** 401 Unauthorized for missing/invalid tokens; 403 Forbidden for insufficient permissions (future-proofing).

</specifics>

<deferred>
## Deferred Ideas

- **Refresh Tokens:** Postponed until session revocation or longer-lived sessions are needed.
- **Email Verification:** Not required for the initial multi-user rollout.
- **OAuth/Social Login:** To be considered for a future milestone.

</deferred>
