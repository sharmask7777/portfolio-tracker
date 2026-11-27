### Task 1: SQLite Schema, Repository & Data Sync Pipeline for Day Change and Returns

**Files:**
- Modify: `mobile/src/db/schema.ts`
- Modify: `mobile/src/db/client.ts`
- Modify: `mobile/src/db/repository.ts`
- Modify: `mobile/src/services/portfolio-calculations.ts`
- Modify: `mobile/src/services/portfolio-service.ts`
- Modify: `mobile/src/components/Holdings/holding-adapters.ts`
- Test: `mobile/src/db/repository.test.ts`
- Test: `mobile/src/services/portfolio-calculations.test.ts`

**Interfaces:**
- Consumes: Server payload `ServerFolioData` with `.metrics.dayChange`, `.metrics.dayChangePercentage`, `.metrics.xirr`, `.metrics.absoluteReturn`, and `.assetCategory`.
- Produces: `HoldingEntity` with `day_change`, `day_change_pct`, `xirr`, `absolute_return`, and `asset_category` persisted and populated in `getEnrichedHoldings()`.

- [ ] **Step 1: Write failing unit tests for schema persistence and mapping**

In `mobile/src/services/portfolio-calculations.test.ts`:
Verify that `mapRawFolioToHolding()` extracts `dayChange`, `dayChangePercentage`, `xirr`, `absoluteReturn`, and `assetCategory` from `ServerFolioData`.
Verify that `summarizeHoldings()` sums non-zero `dayChange` correctly and computes `dayGainPct`.

In `mobile/src/db/repository.test.ts`:
Verify that `upsertHolding()` and `getPortfolioHoldings()` persist and read `day_change`, `day_change_pct`, `xirr`, `absolute_return`, `asset_category`.

- [ ] **Step 2: Run tests to verify failure**

Run: `pnpm --filter mobile test:unit mobile/src/services/portfolio-calculations.test.ts mobile/src/db/repository.test.ts`
Expected: FAIL due to missing properties on `HoldingEntity`.

- [ ] **Step 3: Update `schema.ts`, `client.ts`, and `repository.ts`**

Add `day_change`, `day_change_pct`, `xirr`, `absolute_return`, and `asset_category` to `HoldingEntity` interface and `CREATE_HOLDINGS_TABLE` DDL.
In `client.ts`, add migration alters in `initDatabase` for backward compatibility on existing databases:
```sql
ALTER TABLE holdings ADD COLUMN day_change REAL DEFAULT 0;
ALTER TABLE holdings ADD COLUMN day_change_pct REAL DEFAULT 0;
ALTER TABLE holdings ADD COLUMN xirr REAL DEFAULT 0;
ALTER TABLE holdings ADD COLUMN absolute_return REAL DEFAULT 0;
ALTER TABLE holdings ADD COLUMN asset_category TEXT;
```
(wrapped in try-catch so duplicate column errors are safely ignored).
In `repository.ts`, bind the 5 new columns in `upsertHolding()`.

- [ ] **Step 4: Update `portfolio-calculations.ts`, `portfolio-service.ts`, and `holding-adapters.ts`**

In `portfolio-calculations.ts`:
- Extend `ServerFolioData` interface with `assetCategory?: string; metrics?: { dayChange?: number; dayChangePercentage?: number; xirr?: number; absoluteReturn?: number; ... }`.
- Update `mapRawFolioToHolding()` to store `f.metrics?.dayChange ?? 0`, `f.metrics?.dayChangePercentage ?? 0`, `f.metrics?.xirr ?? 0`, `f.metrics?.absoluteReturn ?? 0`, `f.assetCategory ?? meta.assetClass`.

In `portfolio-service.ts`:
- In `getEnrichedHoldings()`: check `h.day_change` and `h.day_change_pct`. If present and non-zero (or when backend provided it), use them directly; only fall back to `calculateHoldingDayChange(targetDb, h)` when both are 0.

In `holding-adapters.ts`:
- In `adaptHoldingToFolioInput()`: pass `xirr: holding.xirr ?? undefined`, `absoluteReturn: holding.absolute_return ?? (holding.gainLossPct !== undefined ? holding.gainLossPct / 100 : undefined)`, `dayChange: holding.dayChange`, `dayChangePercentage: holding.dayChangePct`.

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter mobile test:unit mobile/src/services/portfolio-calculations.test.ts mobile/src/db/repository.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add mobile/src/db/schema.ts mobile/src/db/client.ts mobile/src/db/repository.ts mobile/src/services/portfolio-calculations.ts mobile/src/services/portfolio-service.ts mobile/src/components/Holdings/holding-adapters.ts mobile/src/services/portfolio-calculations.test.ts mobile/src/db/repository.test.ts
git commit -m "fix(mobile): persist and map day change, returns, and asset category"
```

---

