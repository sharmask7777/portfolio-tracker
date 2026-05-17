# Phase 6: E2E Testing Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-18
**Phase:** 6-E2E Testing Foundation
**Areas discussed:** Test Environment, Data Mocking Strategy, Auth/Session Handling, CI/CD Integration

---

## Test Environment

| Option | Description | Selected |
|--------|-------------|----------|
| Dev Server (vite) | Faster feedback during development; closest to the developer experience. | ✓ |
| Preview (build) | Ensures tests run against the exact code users will execute; catches build-specific issues. | |

**User's choice:** Dev Server (vite)

---

## Data Mocking Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Real Backend | E2E tests verify the full stack; catches API mismatches. Requires a running backend + DB. | |
| Mocked API (route) | Pure UI testing; no backend needed. Faster and more stable, but misses integration bugs. | ✓ |

**User's choice:** Mocked API (route)

---

## Auth/Session Handling

| Option | Description | Selected |
|--------|-------------|----------|
| Static Mocking | The app starts with a default "test user" context in all tests. Simple for now. | ✓ |
| Manual Injection | Tests explicitly set a cookie or localStorage item to simulate different users. | |

**User's choice:** Static Mocking

---

## CI/CD Integration

| Option | Description | Selected |
|--------|-------------|----------|
| Every Pull Request | Maximum confidence; catches regressions immediately. | |
| Merge to main only | Saves CI minutes; run only on merges to main. | ✓ |

**User's choice:** Merge to main only

---

## Claude's Discretion

- Base URL: Configured via environment variable.
- Auto-Start: Enabled via Playwright webServer config.
- Browsers: Chromium only.
- Mock Type: Dynamic generation (reusing MockCASGenerator).
- Upload Mock: Mocked POST response.
- Error States: Included in tests.
- Global Setup: Yes, for future auth needs.
- Persistence: Fresh state for most tests.
- Reset Flow: Included in tests.
- CI Platform: GitHub Actions.
- CI Reporting: Console only.
- Smoke Test: Added for every PR.

## Deferred Ideas

- None — discussion stayed within phase scope.
