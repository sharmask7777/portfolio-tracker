# Phase 18: Backend Authentication Core - Plan

## Goal
Implement the foundation for secure authentication and user management.

## Success Criteria
1. Users can register and login via API.
2. Passwords are encrypted in the database using Bcrypt.
3. JWT tokens are issued upon successful login.
4. `authMiddleware` correctly identifies users from tokens and rejects unauthorized requests.

## Tasks

### 1. Dependency Management
- [x] Install `jsonwebtoken` and `bcryptjs`.
- [x] Install `@types/jsonwebtoken` and `@types/bcryptjs`.

### 2. Environment Configuration
- [x] Add `JWT_SECRET` and `JWT_EXPIRES_IN` to `.env`.

### 3. Type Definitions
- [x] Create `backend/src/types/express.d.ts` to extend `express.Request` with `user`.

### 4. Authentication Service
- [x] Create `backend/src/services/authService.ts`.
- [x] Implement `hashPassword` and `comparePassword`.
- [x] Implement `generateToken` and `verifyToken`.

### 5. Authentication Controller & Routes
- [x] Create `backend/src/routes/authRoutes.ts`.
- [x] Implement `POST /register` endpoint.
- [x] Implement `POST /login` endpoint.
- [x] Register `authRoutes` in `backend/src/index.ts`.

### 6. Authentication Middleware
- [x] Create `backend/src/middleware/authMiddleware.ts`.
- [x] Implement middleware to verify JWT and attach user to `req.user`.

### 7. Integration & Testing
- [x] Create `backend/src/test/auth.test.ts`.
- [x] Verify registration works (user created, password hashed).
- [x] Verify login works (token returned).
- [x] Verify `authMiddleware` protects routes.

## Verification Plan
- Run `npm run test backend/src/test/auth.test.ts`.
- Manual verification using `curl` or Postman for register/login.
