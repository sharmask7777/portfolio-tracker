# Business Logic Audit & Hardcoded Hacks Elimination Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate short-term hacks, obsolete mocks, hardcoded exchange rates/fallbacks, and fix critical business logic flaws in gold pricing, tax harvesting exemption filtering, and X-Ray analytics asset classification.

**Architecture:** 
1. Fix `MarketDataService.getGoldPrice` to query the live `https://api.gold-api.com/price/XAU/INR` endpoint with direct INR currency rates and troy-ounce conversion, removing the hardcoded 84 USD/INR multiplier and 7500 fallback.
2. Update `HarvestingService` to strictly check `TaxService.isEquity()` so debt/liquid mutual funds do not consume the Section 112A equity LTCG exemption nor get recommended as tax-free harvesting candidates. Deduplicate FY date logic with `FYUtils`.
3. Enhance `XRayService.parseCategory` and asset allocation fallback so missing FinAPI data for debt, liquid, gold, and hybrid funds does not blindly default to 100% active equity.
4. Clean up development hacks: remove `mock-token` bypass in `AuthService`, enforce proper password hashing or rejection of missing users in `SyncService`, and remove obsolete `MOCK_USER_ID` in `frontend/src/config.ts`.
5. Centralize tax constants (`DEFAULT_TAX_SLAB`, `LTCG_EXEMPTION_LIMIT`) to eliminate magic numbers across routes and services.

**Tech Stack:** TypeScript, Node.js, Express, Jest, Vitest, Playwright, Prisma, Docker.

---

### Task 1: Fix Gold Price Live API & Conversion in MarketDataService

**Files:**
- Modify: `backend/src/services/market-data.service.ts`
- Modify: `backend/src/services/market-data.service.spec.ts`

- [ ] **Step 1: Write unit tests for getGoldPrice in `market-data.service.spec.ts`**

Add tests covering:
1. Returns cached price if present.
2. Fetches from `https://api.gold-api.com/price/XAU/INR`, converts per troy ounce (31.1034768g), and caches result.
3. Graceful handling on network failure.

```typescript
  describe('getGoldPrice', () => {
    it('should return cached price if available', async () => {
      (CacheService.get as jest.Mock).mockResolvedValue(7850);
      const price = await MarketDataService.getGoldPrice();
      expect(price).toBe(7850);
      expect(axios.get).not.toHaveBeenCalled();
    });

    it('should fetch price in INR from API and convert per gram', async () => {
      (CacheService.get as jest.Mock).mockResolvedValue(null);
      (axios.get as jest.Mock).mockResolvedValue({
        data: { price: 311034.768, currency: 'INR' },
      });

      const price = await MarketDataService.getGoldPrice();
      expect(axios.get).toHaveBeenCalledWith('https://api.gold-api.com/price/XAU/INR', { timeout: 10000 });
      expect(price).toBeCloseTo(10000, 1);
      expect(CacheService.set).toHaveBeenCalledWith('gold_price_inr', expect.any(Number), 3600);
    });
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/services/market-data.service.spec.ts -t "getGoldPrice"`
Expected: FAIL (because current implementation queries `/api/v1/gold` and multiplies by 84).

- [ ] **Step 3: Update `MarketDataService.getGoldPrice` in `market-data.service.ts`**

Update `GOLD_API_BASE` to `'https://api.gold-api.com/price/XAU/INR'`.
Use `TROY_OUNCE_TO_GRAMS = 31.1034768`.
Parse `response.data.price / TROY_OUNCE_TO_GRAMS`.
Remove hardcoded 84 USD/INR rate and hardcoded 7500 fallback.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/services/market-data.service.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/market-data.service.ts backend/src/services/market-data.service.spec.ts
git commit -m "fix(market-data): use live INR gold api endpoint and remove hardcoded exchange rate"
```

---

### Task 2: Fix Equity LTCG Harvesting Exemption Filter in HarvestingService

**Files:**
- Modify: `backend/src/services/tax.service.ts`
- Modify: `backend/src/services/harvesting.service.ts`
- Modify: `backend/src/services/harvesting.service.spec.ts`

- [ ] **Step 1: Write unit tests in `harvesting.service.spec.ts` verifying Debt funds are excluded**

```typescript
    it('should exclude debt funds from LTCG exemption harvesting', async () => {
      (prisma.portfolio.findMany as jest.Mock).mockResolvedValue([{
        id: 'p1',
        folios: [
          {
            id: 'f_debt',
            asset: { name: 'HDFC Corporate Bond Fund', type: AssetType.MUTUAL_FUND, amfiCode: '102' },
            transactions: [
              { type: 'BUY', units: 100, nav: 100, date: new Date('2022-01-01'), amount: 10000, balance: 100 },
            ],
          },
        ],
      }]);

      (MarketDataService.getLatestNAV as jest.Mock).mockResolvedValue(150);

      const result = await HarvestingService.getHarvestingOpportunities('consolidated', 'u1');

      expect(result.opportunities.length).toBe(0);
      expect(result.totalPotentialHarvest).toBe(0);
    });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/services/harvesting.service.spec.ts`
Expected: FAIL (because debt funds were previously treated as harvestable).

- [ ] **Step 3: Implement the fix in `TaxService` and `HarvestingService`**

1. Make `TaxService.isEquity(assetType: AssetType, assetName: string): boolean` `public`.
2. In `HarvestingService.getHarvestingOpportunities`:
   - Replace manual FY date calculation with `FYUtils.getFYDates(FYUtils.getFY())`.
   - When calculating `realizedLTCG_FY`, verify that the folio is equity:
     ```ts
     const isEquity = TaxService.isEquity(folio.asset.type, folio.asset.name);
     if (isEquity) {
       const fyGains = taxSummary.realized.details.filter(
         (g) => g.taxType === 'LTCG' && g.sellDate >= fyDates.start && g.sellDate <= fyDates.end
       );
       realizedLTCG_FY += fyGains.reduce((acc, g) => acc + g.gain, 0);
     }
     ```
   - When scanning for unrealized LTCG opportunities:
     ```ts
     const isEquity = TaxService.isEquity(folio.asset.type, folio.asset.name);
     if (!isEquity) continue;
     ```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/services/harvesting.service.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/tax.service.ts backend/src/services/harvesting.service.ts backend/src/services/harvesting.service.spec.ts
git commit -m "fix(tax): restrict section 112A LTCG harvesting exemption to equity assets"
```

---

### Task 3: Fix XRay Categorization & Asset Allocation Fallbacks

**Files:**
- Modify: `backend/src/services/xray.service.ts`
- Modify: `backend/src/services/xray.service.spec.ts`

- [ ] **Step 1: Write unit tests in `xray.service.spec.ts` for missing FinAPI fallback on Debt and Gold funds**

```typescript
  it('should categorize debt and liquid funds as debt even if external holdings data is missing', async () => {
    (prisma.portfolio.findUnique as jest.Mock).mockResolvedValue({
      id: 'p_debt',
      folios: [
        {
          asset: { isin: 'ISIN_DEBT', amfiCode: '103', name: 'ICICI Liquid Fund', type: 'MUTUAL_FUND' },
          transactions: [{ type: 'BUY', units: 100, balance: 100, nav: 10, date: new Date() }],
        },
      ],
    });

    (MarketDataService.getLatestNAV as jest.Mock).mockResolvedValue(10);
    (MarketDataService.getHoldings as jest.Mock).mockResolvedValue(null);

    const xray = await XRayService.getXRayData('p_debt', 'u1');

    expect(xray.assetAllocation.debt.percentage).toBe(1.0);
    expect(xray.assetAllocation.equity.percentage).toBe(0.0);
    expect(xray.expenseAnalysis.fundBreakdown[0].category).toBe('Debt');
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/services/xray.service.spec.ts -t "should categorize debt and liquid funds"`
Expected: FAIL (because previous fallback blindly assigned 100% to equity).

- [ ] **Step 3: Implement enhanced category parsing and non-equity fallback in `xray.service.ts`**

1. Expand `parseCategory`:
   ```ts
   private static parseCategory(name: string, schemeCat: string): string {
     const lowerName = name.toLowerCase();
     const lowerCat = (schemeCat || '').toLowerCase();
     if (lowerName.includes('arbitrage') || lowerCat.includes('arbitrage')) return 'Arbitrage';
     if (lowerName.includes('index') || lowerCat.includes('index') || lowerName.includes('etf')) return 'Index';
     if (lowerCat.includes('international') || lowerCat.includes('global')) return 'International';
     if (
       lowerName.includes('debt') || lowerName.includes('liquid') || lowerName.includes('gilt') ||
       lowerName.includes('bond') || lowerName.includes('overnight') || lowerName.includes('money market') ||
       lowerCat.includes('debt') || lowerCat.includes('income')
     ) return 'Debt';
     if (lowerName.includes('gold') || lowerName.includes('silver') || lowerCat.includes('commodity')) return 'Commodity / Gold';
     if (lowerName.includes('hybrid') || lowerName.includes('balanced') || lowerCat.includes('hybrid')) return 'Hybrid';
     return 'Active Equity';
   }
   ```
2. In `aggregateHoldings`, if `!data`:
   ```ts
   if (!data) {
     if (isArbitrage) {
       assetAllocation.debt += 100 * weightFactor;
       exArbAssetAllocation.arbitrage += 100 * weightFactor;
     } else if (category === 'Debt') {
       assetAllocation.debt += 100 * weightFactor;
       exArbAssetAllocation.debt += 100 * weightFactor;
     } else if (category === 'Commodity / Gold') {
       assetAllocation.gold += 100 * weightFactor;
       exArbAssetAllocation.gold += 100 * weightFactor;
     } else if (category === 'Hybrid') {
       assetAllocation.equity += 65 * weightFactor;
       assetAllocation.debt += 25 * weightFactor;
       assetAllocation.cash += 10 * weightFactor;
       exArbAssetAllocation.equity += 65 * weightFactor;
       exArbAssetAllocation.debt += 25 * weightFactor;
       exArbAssetAllocation.cash += 10 * weightFactor;
     } else {
       assetAllocation.equity += 100 * weightFactor;
       exArbAssetAllocation.equity += 100 * weightFactor;
     }
     continue;
   }
   ```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/services/xray.service.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/xray.service.ts backend/src/services/xray.service.spec.ts
git commit -m "fix(xray): accurately classify debt, liquid, and commodity funds on missing api data"
```

---

### Task 4: Remove Development Mocks & Insecure Auto-Creation

**Files:**
- Modify: `backend/src/services/sync.service.ts`
- Modify: `backend/src/services/authService.ts`
- Modify: `frontend/src/config.ts`

- [ ] **Step 1: Clean up `backend/src/services/authService.ts`**

Remove the `mock-token` bypass in `AuthService.verifyToken`:
```typescript
  static verifyToken(token: string): any {
    try {
      return jwt.verify(token, JWT_SECRET);
    } catch (error) {
      return null;
    }
  }
```

- [ ] **Step 2: Clean up `backend/src/services/sync.service.ts`**

Replace plaintext `password: 'mock-password'` auto-creation with:
In production (`process.env.NODE_ENV === 'production'`), throw `new Error(\`User with ID \${userId} not found\`)`.
In non-production, hash the password using `await AuthService.hashPassword(crypto.randomUUID())` to prevent insecure default credentials.

- [ ] **Step 3: Clean up `frontend/src/config.ts`**

Remove the obsolete `MOCK_USER_ID: 'mock-user-123'` line.

- [ ] **Step 4: Run backend and frontend unit tests**

Run: `npx jest src/services/sync.service.spec.ts src/test/worker.test.ts`
Run: `npm run test:unit --prefix frontend`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/authService.ts backend/src/services/sync.service.ts frontend/src/config.ts
git commit -m "refactor: eliminate insecure mock credentials and obsolete dev constants"
```

---

### Task 5: Centralize Tax Constants & Eliminate Magic Numbers

**Files:**
- Modify: `backend/src/services/tax.service.ts`
- Modify: `backend/src/services/harvesting.service.ts`
- Modify: `backend/src/services/tax-analyzer.service.ts`
- Modify: `backend/src/routes/portfolio.routes.ts`
- Modify: `backend/src/routes/tax.routes.ts`

- [ ] **Step 1: Export tax constants in `TaxService`**

```typescript
export class TaxService {
  public static readonly DEFAULT_TAX_SLAB = 0.30;
  public static readonly LTCG_EXEMPTION_LIMIT = 125000; // Section 112A post Budget 2024
  public static readonly PRE_BUDGET_2024_LTCG_EXEMPTION_LIMIT = 100000;
  ...
```

- [ ] **Step 2: Reference `TaxService.DEFAULT_TAX_SLAB` and `TaxService.LTCG_EXEMPTION_LIMIT` across all routes and services**

Replace hardcoded `0.30` and `125000` in:
- `harvesting.service.ts`
- `tax-analyzer.service.ts`
- `portfolio.routes.ts`
- `tax.routes.ts`

- [ ] **Step 3: Run all unit test suites**

Run: `npx jest src/services/harvesting.service.spec.ts src/services/tax.service.spec.ts src/services/tax-analyzer.service.spec.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add backend/src/services/tax.service.ts backend/src/services/harvesting.service.ts backend/src/services/tax-analyzer.service.ts backend/src/routes/portfolio.routes.ts backend/src/routes/tax.routes.ts
git commit -m "refactor: centralize tax slab and exemption constants across services and routes"
```

---

### Task 6: Full Verification & E2E Testing

**Files:**
- None (verification phase)

- [ ] **Step 1: Run frontend unit tests**
Run: `npm run test:unit --prefix frontend`

- [ ] **Step 2: Run backend Docker test**
Run: `npm run test:docker --prefix backend`

- [ ] **Step 3: Run frontend Docker test**
Run: `npm run test:docker --prefix frontend`

- [ ] **Step 4: Run E2E test stack against Docker**
Run: `npm run docker:up && npm run test:e2e:docker --prefix frontend && npm run docker:down`
