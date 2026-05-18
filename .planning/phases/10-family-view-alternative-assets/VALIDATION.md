---
phase: "10"
slug: family-view-alternative-assets
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-05-20
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest / playwright |
| **Config file** | `backend/jest.config.js` / `frontend/playwright.config.ts` |
| **Quick run command** | `npm test backend` |
| **Full suite command** | `npm test backend && npx playwright test` |
| **Estimated runtime** | ~60 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test backend`
- **After every plan wave:** Run `npm test backend`
- **Before /gsd:verify-work:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 10-01-01 | 01 | 1 | V3-FAM-01 | — | N/A | unit | `npx prisma validate` | ✅ | ⬜ pending |
| 10-01-02 | 01 | 1 | V3-FAM-02 | T-10-01 | `userId` check in update | unit | `npm test backend/src/test/family.profile.test.ts` | ❌ W0 | ⬜ pending |
| 10-01-03 | 01 | 1 | V3-FAM-03 | — | Aggregation correctness | unit | `npm test backend/src/test/performance.aggregate.test.ts` | ❌ W0 | ⬜ pending |
| 10-02-01 | 02 | 2 | V3-FAM-01 | T-10-03 | Auth `userId` required | integration | `npm test backend/src/test/sync.split.test.ts` | ❌ W0 | ⬜ pending |
| 10-02-02 | 02 | 2 | V3-FAM-02 | T-10-01 | Auth `userId` required | integration | `curl -X PATCH -H "Content-Type: application/json" -d '{"name": "Spouse"}' "http://localhost:3001/api/family/profile/mock-id"` | ✅ | ⬜ pending |
| 10-02-03 | 02 | 2 | V3-FAM-03 | T-10-04 | Validate profile ownership | integration | `curl -s "http://localhost:3001/api/portfolio/summary?profileId=mock-id&taxSlab=0.3"` | ✅ | ⬜ pending |
| 10-03-01 | 03 | 3 | V3-FAM-02 | T-10-05 | Authorized profiles only | unit | `npm run test:unit FamilySelector` | ❌ W0 | ⬜ pending |
| 10-03-02 | 03 | 3 | V3-FAM-03 | — | Symmetric pre/post tax display | unit | `npm run test:unit StatsGrid` | ❌ W0 | ⬜ pending |
| 10-03-03 | 03 | 3 | V3-FAM-02 | — | End-to-end family view | e2e | `npx playwright test frontend/tests/family-view.spec.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/src/test/performance.aggregate.test.ts` — stubs for REQ-10.3
- [ ] `backend/src/test/family.profile.test.ts` — stubs for V3-FAM-02
- [ ] `backend/src/test/sync.split.test.ts` — stubs for V3-FAM-01
- [ ] `frontend/src/components/FamilySelector.test.tsx` — unit tests for UI component
- [ ] `frontend/src/components/StatsGrid.test.tsx` — unit tests for UI component
- [ ] `frontend/tests/family-view.spec.ts` — E2E stubs for V3-FAM-03

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Visual polish | V3-FAM-02 | Check UI | Run `npm run dev` and verify layout |

---

## Validation Sign-Off

- [x] All tasks have <automated> verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
