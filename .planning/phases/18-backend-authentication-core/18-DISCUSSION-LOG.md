# Phase 18: Backend Authentication Core - Discussion Log

**Date:** 2026-05-19
**Phase:** 18
**Goal:** Implement the foundation for secure authentication and user management.

## Discussion Summary

| Area | Options Presented | Selection | Notes |
|---|---|---|---|
| **Token Strategy** | Stateless JWT vs. Refresh Tokens | **Stateless JWT** | User prioritized simplicity and statelessness. |
| **Registration Policy** | Open vs. Invite-Only | **Open Signup** | Defaulting to open access for new users. |
| **Password Policy** | Strict vs. Basic | **Basic** | Keeping it simple for now; focus on hashing rather than complex validation rules. |
| **Session Revocation** | Revocable vs. Simple Expiry | **Simple Expiration** | Simple expiry is sufficient for the current use case. |

## Key Decisions
- Use **Bcrypt** for hashing passwords.
- Implement a custom **Express middleware** to handle JWT verification.
- Store the user identity in **req.user** for downstream routes.

## Deferred Ideas
- Refresh tokens and session revocation.
- Invite-only signup restrictions.
