# Deep Dive Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a SlideOutPanel in the frontend and a cached external API integration in the backend to display deep-dive data (TER, PE, News, Sentiment) for assets, along with comprehensive hermetic backend tests and Playwright E2E tests.

**Architecture:** The React frontend triggers a `SlideOutPanel` on asset click, fetching from a new Express route `GET /api/analytics/deepdive/:symbol`. The backend fetches from mockable external APIs and caches the data in Redis to prevent rate limits. Tests use `jest-mock-extended` for the backend and `page.route` for frontend E2E stability.

**Tech Stack:** React, Tailwind CSS (or existing UI framework), Express, Node.js, Redis, Jest, Playwright.

---

### Task 1: Backend Setup & External API Service

**Files:**
- Create: `backend/src/services/deepdive.service.ts`
- Create: `backend/src/controllers/deepdive.controller.ts`
- Modify: `backend/src/routes/analytics.routes.ts`

- [ ] **Step 1: Write the failing tests for Deep Dive Service**
Create `backend/test/services/deepdive.service.test.ts` to test fetching and caching logic.
```typescript
import { DeepDiveService } from '../../src/services/deepdive.service';
import cacheService from '../../src/services/cache.service';
import axios from 'axios';

jest.mock('axios');
jest.mock('../../src/services/cache.service');

describe('DeepDiveService', () => {
    it('should fetch and cache fundamental data', async () => {
        (cacheService.get as jest.Mock).mockResolvedValue(null);
        (axios.get as jest.Mock).mockResolvedValue({ data: { peRatio: 15.5 } });
        
        const data = await DeepDiveService.getAssetFundamentals('AAPL');
        expect(data.peRatio).toBe(15.5);
        expect(cacheService.set).toHaveBeenCalled();
    });
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `npm test --prefix backend -- backend/test/services/deepdive.service.test.ts`
Expected: FAIL (module not found)

- [ ] **Step 3: Implement DeepDiveService and Controller**
Create `backend/src/services/deepdive.service.ts` using `axios` and existing `cache.service.ts`.
Create `backend/src/controllers/deepdive.controller.ts`.
Wire it up in `backend/src/routes/analytics.routes.ts`.

- [ ] **Step 4: Run test to verify it passes**
Run: `npm test --prefix backend -- backend/test/services/deepdive.service.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add backend/src/services/deepdive.service.ts backend/src/controllers/deepdive.controller.ts backend/src/routes/analytics.routes.ts backend/test/services/deepdive.service.test.ts
git commit -m "feat(backend): add deep dive service with caching and hermetic tests"
```

### Task 2: Frontend SlideOutPanel Component

**Files:**
- Create: `frontend/src/features/holdings/components/SlideOutPanel.tsx`
- Create: `frontend/src/features/holdings/components/DeepDiveContent.tsx`

- [ ] **Step 1: Write minimal SlideOutPanel**
Create `SlideOutPanel.tsx` with a basic sliding animation or conditional rendering based on props (`isOpen`, `onClose`, `symbol`). 

- [ ] **Step 2: Write DeepDiveContent with Tabs**
Create `DeepDiveContent.tsx` to handle the data fetching (using `axios` or existing fetch utilities) from `/api/analytics/deepdive/:symbol` and render the three tabs: Overview, Fundamentals, News & Sentiment. Include error state handling.

- [ ] **Step 3: Integrate into Holdings/X-Ray View**
Modify the main holdings view file (e.g., `frontend/src/features/holdings/HoldingsTable.tsx`) to statefully render `<SlideOutPanel>` when a row is clicked.

- [ ] **Step 4: Commit**
```bash
git add frontend/src/features/holdings/
git commit -m "feat(frontend): add SlideOutPanel and DeepDiveContent with tabbed navigation"
```

### Task 3: Playwright E2E Tests

**Files:**
- Create/Modify: `frontend/tests/deepdive.spec.ts`

- [ ] **Step 1: Write E2E test with mocked API**
```typescript
import { test, expect } from '@playwright/test';

test('opens deep dive panel and displays mocked data', async ({ page }) => {
  // Intercept the deep dive API call to ensure stability
  await page.route('**/api/analytics/deepdive/*', async route => {
    const json = { fundamentals: { peRatio: 25 }, news: [] };
    await route.fulfill({ json });
  });

  await page.goto('/');
  // Assume there is a row with text AAPL
  await page.click('text=AAPL');
  
  // Verify panel opens
  const panel = page.locator('text=Deep Dive');
  await expect(panel).toBeVisible();
  
  // Verify mocked data is shown
  await expect(page.locator('text=25')).toBeVisible();
});
```

- [ ] **Step 2: Run E2E test to verify it passes**
Run: `npm run test:e2e --prefix frontend -- frontend/tests/deepdive.spec.ts`
Expected: PASS

- [ ] **Step 3: Commit**
```bash
git add frontend/tests/deepdive.spec.ts
git commit -m "test(frontend): add stable E2E tests for deep dive panel"
```
