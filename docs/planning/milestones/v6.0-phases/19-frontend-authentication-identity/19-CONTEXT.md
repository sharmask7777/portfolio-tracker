# Phase 19: Frontend Authentication & Identity - Context

**Gathered:** 2026-05-19
**Status:** Ready for planning
**Mode:** Discuss

<domain>
## Phase Boundary

Phase 19 bridges the gap between the secure backend (Phase 18) and the user interface. It introduces the concept of a "session" to the frontend. Users will transition from a single-user mock state to a multi-user system where they must authenticate to see their data.

</domain>

<decisions>
## Implementation Decisions

| Area | Decision | Rationale |
|---|---|---|
| **Routing** | `react-router-dom` | Industry standard for React routing. Necessary to separate Auth pages from the Dashboard. |
| **Session Storage** | `localStorage` | Persists JWT across refreshes. Simple implementation for the current requirements. |
| **Auth State** | Context API (`AuthContext`) | Provides global access to user identity and token. |
| **API Integration** | Axios Interceptor | Automatically attaches `Authorization: Bearer <token>` to all outgoing requests. |
| **Route Protection** | `ProtectedRoute` Wrapper | Declarative way to protect dashboard routes. Redirects to `/login` if unauthenticated. |

</decisions>

<code_context>
## Existing Code Insights

- **Current Structure:** One large `App.tsx` component managing tabs via local state.
- **Mock Data:** Routes currently use `API_CONFIG.MOCK_USER_ID`. This will be replaced by the authenticated user's ID in Phase 20, but the frontend will start sending the token now.
- **Dependencies:** `react-router-dom` is NOT installed. `axios` IS installed.

</code_context>

<specifics>
## Specific Requirements

- **Login Page:** Email/Password input with error handling.
- **Signup Page:** Email/Password input with error handling.
- **Logout:** Clears `localStorage` and resets `AuthContext`.
- **Persistence:** User stays logged in on page refresh if token is valid.

</specifics>

<deferred>
## Deferred Ideas

- **Password Reset:** Postponed.
- **Remember Me:** JWT expiration handles this for now.
- **Loading State Refinement:** Focus on functional auth first.

</deferred>
