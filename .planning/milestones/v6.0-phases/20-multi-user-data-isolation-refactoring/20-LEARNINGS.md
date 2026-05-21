---
phase: 20
phase_name: "Multi-User Data Isolation & Refactoring"
project: "Portfolio Tracker"
generated: "2026-05-19"
counts:
  decisions: 3
  lessons: 1
  patterns: 2
  surprises: 1
missing_artifacts:
  - "20-VERIFICATION.md"
  - "20-UAT.md"
---

# Phase 20 Learnings: Multi-User Data Isolation & Refactoring

## Decisions

### Auth Strategy (Milestone 6.0)
Use JWT for session management and Bcrypt for password hashing.

**Rationale:** Industry standard practices for robust and secure session management.
**Source:** STATE.md

---

### Strict Data Isolation
Every database query will be scoped to `req.user.id`.

**Rationale:** Ensure users can only access and modify their own data, preventing cross-user data leakage.
**Source:** STATE.md

---

### Removal of Mock User References
Purge all fallback references to `mock-user-123` from controllers and the service layer.

**Rationale:** Transition the system from a single-user prototype to a production-ready multi-user application.
**Source:** 20-SUMMARY.md

---

## Lessons

### Silent Isolation Verification
Verification of data isolation returns a 200 OK with an empty array or 0 values rather than a 403 Forbidden.

**Context:** When User B attempts to fetch User A's data, the system correctly interprets the request as "User B has no data matching these parameters." This approach is preferred over throwing an error, as it prevents leaking the existence of data belonging to other users.
**Source:** 20-SUMMARY.md

---

## Patterns

### Universal authMiddleware Application
Applying `authMiddleware` to all routes in protected route files (e.g., `/api/portfolio`, `/api/tax`, `/api/health`, `/api/family`).

**When to use:** On all API routes requiring user authentication and session injection.
**Source:** 20-SUMMARY.md

---

### Identity-Scoped Database Queries
Filtering every database operation by the authenticated user's ID (`req.user.id`).

**When to use:** Whenever performing DB operations in a multi-user environment to prevent unauthorized cross-user data access.
**Source:** 20-SUMMARY.md

---

## Surprises

### Privacy-Preserving Isolation Checks
The impact of returning empty data instead of error messages for unauthorized cross-user requests.

**What was surprising:** The realization that returning a successful but empty response is a better security pattern for hiding the existence of other users' data than explicit "Access Denied" errors.
**Impact:** Enhances overall system privacy and prevents subtle information leaks through ID probing.
**Source:** 20-SUMMARY.md
