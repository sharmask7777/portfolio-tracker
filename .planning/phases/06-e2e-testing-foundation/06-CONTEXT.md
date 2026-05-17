# Phase 6: E2E Testing Foundation - Context

**Gathered:** 2026-05-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Establish a robust End-to-End testing suite for the frontend using Playwright. This includes environment setup, network mocking primitives, and coverage for the core CAS upload/parsing flow.

</domain>

<decisions>
## Implementation Decisions

### Test Environment
- **D-01:** Run tests against the local dev server (`vite`) for faster feedback.
- **D-02:** Configure baseURL via environment variables for portability (local vs. CI).
- **D-03:** Use Playwright's `webServer` config to automatically start/stop the frontend during test runs.
- **D-04:** Initial browser support is limited to **Chromium** to optimize speed and resource usage.

### Data Mocking Strategy
- **D-05:** Use Playwright's network mocking (`page.route`) to isolate frontend tests from backend state.
- **D-06:** Leverage the Phase 5 `MockCASGenerator` to provide dynamic, realistic mock data for all API responses.
- **D-07:** Mock the upload POST response entirely (simulate parse result JSON).
- **D-08:** Explicitly test API error states (4xx/5xx) to verify UI resilience.

### Auth/Session Handling
- **D-09:** Use static mocking for the initial user context (a default "test user").
- **D-10:** Implement a global Playwright setup/teardown to handle session injection/reset for future-proofing.
- **D-11:** Most tests start in a fresh, clean state.
- **D-12:** Include E2E coverage for data reset/logout flows.

### CI/CD Integration
- **D-13:** Use GitHub Actions as the primary CI platform.
- **D-14:** Run the full E2E suite only on merges to `main` to save CI minutes.
- **D-15:** Implement a minimal "Smoke Test" (check app load) that runs on every Pull Request.
- **D-16:** CI reporting will be limited to console output for initial simplicity.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Core
- `.planning/ROADMAP.md` — Phase 6 scope and goals.
- `.planning/REQUIREMENTS.md` — Scoped requirements for Milestone v2.0.

### Reusable Testing Logic
- `backend/test-utils/MockCASGenerator.ts` — The generator to be reused for dynamic E2E mocks.
- `backend/src/test/arbitraries.ts` — Reference for CAS data structures.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `MockCASGenerator`: Can be imported/leveraged in Playwright setup to generate dynamic payloads for `page.route`.

### Established Patterns
- `vite`: Project uses Vite, so Playwright should integrate with the standard `vite dev` and `vite preview` flows.

### Integration Points
- `frontend/package.json`: Playwright should be added as a devDependency here.
- `.github/workflows/`: New workflow file to be created for E2E CI.

</code_context>

<specifics>
## Specific Ideas

- Ensure that Playwright's `webServer` uses the same port as the local dev server (default 5173).
- Mocking should intercept the exact endpoints used by the frontend (e.g., `/api/portfolio/upload`).

</specifics>

<deferred>
## Deferred Ideas

- Full cross-browser testing (Firefox, Webkit) — deferred to a future stabilization phase.
- Real backend integration tests — deferred in favor of UI-focused mocked E2E.

</deferred>

---

*Phase: 6-E2E Testing Foundation*
*Context gathered: 2026-05-18*
