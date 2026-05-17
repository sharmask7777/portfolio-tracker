---
phase: 06-e2e-testing-foundation
plan: 06-02
subsystem: frontend
tags: ["e2e", "mocking", "pom"]
requirements: ["V2-E2E-01"]
tech-stack: ["playwright", "faker"]
key-files: ["frontend/tests/utils/cas-mock.ts", "frontend/tests/pom/UploadPage.ts", "frontend/tests/pom/DashboardPage.ts"]
metrics:
  duration: 15m
  completed_date: 2024-05-17
---

# Phase 06 Plan 02: Mocking Infrastructure & POMs Summary

Implemented the foundational mocking utilities and Page Object Models (POMs) for Playwright E2E tests.

## Key Changes

### Mocking Infrastructure
- Created `frontend/tests/utils/cas-mock.ts` which provides `mockCASUpload` and `mockAPIError`.
- Integrated `MockCASGenerator` from the backend to ensure consistent mock data between unit and E2E tests.
- Added `frontend/tests/utils/auth-setup.ts` to handle session mocking.

### Page Object Models (POMs)
- `UploadPage.ts`: Encapsulates interactions with the CAS import modal and file upload logic.
- `DashboardPage.ts`: Provides methods to verify portfolio metrics (Net Worth, Schemes) and navigate tabs.

## Verification Results
- All files created in `frontend/tests/`.
- `MockCASGenerator` correctly imported via relative path.
- POMs use Playwright locators compatible with the current `App.tsx` structure.

## Self-Check: PASSED
- [x] `frontend/tests/utils/cas-mock.ts` exists.
- [x] `frontend/tests/pom/UploadPage.ts` exists.
- [x] `frontend/tests/pom/DashboardPage.ts` exists.
- [x] Commits made for each task.
