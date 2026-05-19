# Phase 19: Frontend Authentication & Identity - Plan

## Goal
Connect the frontend to the authentication system and implement user session management.

## Success Criteria
1. Login and Signup pages are functional and visual.
2. `AuthContext` successfully persists the user session (JWT).
3. Private routes (Dashboard, etc.) are only accessible to logged-in users.
4. Logout clears the session and redirects to the login page.
5. All API calls include the JWT token.

## Tasks

### 1. Dependency Management
- [x] Install `react-router-dom`.

### 2. Authentication Context & Services
- [x] Create `frontend/src/contexts/AuthContext.tsx`.
- [x] Implement `login`, `signup`, and `logout` methods.
- [x] Implement token persistence using `localStorage`.
- [x] Setup `axios` interceptor in `frontend/src/config.ts` or a new `api.ts`.

### 3. Authentication Components
- [x] Create `frontend/src/components/Auth/LoginPage.tsx`.
- [x] Create `frontend/src/components/Auth/SignupPage.tsx`.
- [x] Create `frontend/src/components/Auth/ProtectedRoute.tsx`.

### 4. Routing Refactor
- [x] Wrap `main.tsx` with `BrowserRouter`.
- [x] Refactor `App.tsx` to use `Routes` and `Route`.
- [x] Move current `App` content into a `Dashboard` component or a layout.

### 5. API Client Refactor
- [x] Update `frontend/src/config.ts` to export a pre-configured `axios` instance.
- [x] Replace `axios.get` calls in components with the configured instance.

### 6. Verification & Testing
- [x] Verify signup creates a user and logs them in.
- [x] Verify login works for existing users.
- [x] Verify redirection from `/` to `/login` for unauthenticated users.
- [x] Verify logout works.

## Verification Plan
- Manual E2E testing of the Auth flow.
- Verify JWT is present in request headers in Browser DevTools.
