# Milestone v6.0 Requirements: Authentication & Multi-User Support

## Backend Authentication (AUTH-B)
- **AUTH-B-01**: Implement User Registration with password hashing (Bcrypt).
- **AUTH-B-02**: Implement User Login with JWT token generation.
- **AUTH-B-03**: Create an `/api/auth/me` endpoint to fetch the current user profile.
- **AUTH-B-04**: Implement `authenticate` middleware to protect API routes.
- **AUTH-B-05**: Implement JWT secret management via environment variables.

## Frontend Authentication (AUTH-F)
- **AUTH-F-01**: Implement `AuthContext` to manage user session and tokens.
- **AUTH-F-02**: Create a Login page with error handling.
- **AUTH-F-03**: Create a Signup page for new user registration.
- **AUTH-F-04**: Implement Protected Routes to redirect unauthenticated users to Login.
- **AUTH-F-05**: Implement Logout functionality to clear sessions and tokens.

## Multi-User Support & Isolation (MULTI)
- **MULTI-01**: Refactor all Backend routes to use `req.user.id` instead of hardcoded `mock-user-123`.
- **MULTI-02**: Ensure all database queries are scoped to the authenticated `userId`.
- **MULTI-03**: Implement User Profile management (basic name/email updates).
- **MULTI-04**: Verify that User A cannot access User B's portfolios or transactions.

## Traceability
| Req ID    | Phase    |
|-----------|----------|
| AUTH-B-01 | Phase 18 |
| AUTH-B-02 | Phase 18 |
| AUTH-B-03 | Phase 18 |
| AUTH-B-04 | Phase 18 |
| AUTH-B-05 | Phase 18 |
| AUTH-F-01 | Phase 19 |
| AUTH-F-02 | Phase 19 |
| AUTH-F-03 | Phase 19 |
| AUTH-F-04 | Phase 19 |
| AUTH-F-05 | Phase 19 |
| MULTI-01  | Phase 20 |
| MULTI-02  | Phase 20 |
| MULTI-03  | Phase 20 |
| MULTI-04  | Phase 20 |
