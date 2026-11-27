# Phase 20: Multi-User Data Isolation & Refactoring - Plan

## Goal
Ensure every user's data is strictly isolated and remove all mock user references from the backend.

## Success Criteria
1. All API routes use the authenticated user's ID from `req.user.id`.
2. Data isolation is verified (one user cannot see another's data).
3. The system no longer relies on or references `mock-user-123`.
4. All routes are protected by `authMiddleware`.

## Tasks

### 1. Route Refactoring: Portfolio
- [ ] Update `backend/src/routes/portfolio.routes.ts` to use `authMiddleware`.
- [ ] Replace `userId = req.query.userId || 'mock-user-123'` with `req.user!.id`.
- [ ] Apply middleware to all routes in this file.

### 2. Route Refactoring: Tax
- [ ] Update `backend/src/routes/tax.routes.ts` to use `authMiddleware`.
- [ ] Replace mock `userId` references.

### 3. Route Refactoring: Health
- [ ] Update `backend/src/routes/health.routes.ts` to use `authMiddleware`.
- [ ] Replace mock `userId` references.

### 4. Route Refactoring: Family
- [ ] Update `backend/src/routes/family.routes.ts` to use `authMiddleware`.
- [ ] Replace mock `userId` references.

### 5. Cleanup
- [ ] Grep for any remaining `mock-user-123` in the backend and remove.
- [ ] Update `backend/src/services/db.service.ts` if it has any mock defaults (unlikely, but check).

### 6. Verification & Isolation Testing
- [ ] Create `backend/src/test/isolation.test.ts`.
- [ ] Verify User A cannot access User B's portfolio.
- [ ] Verify User A cannot access User B's family groups.

## Verification Plan
- Run `npm test` on all updated routes.
- Manual verification: Login as User A, try to access `/api/portfolio/summary` of User B (if ID known) and expect 404 or empty.
