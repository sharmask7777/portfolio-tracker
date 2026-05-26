# Portfolio Daily Changes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a 1-Day change (₹ value and percentage) to the portfolio total and individual assets in the UI, calculated on-the-fly.

**Architecture:** We will modify `MarketDataService` to query the most recent NAV prior to today. The portfolio summary route will fetch both the latest NAV and the previous NAV for each asset, calculate the difference, and aggregate it to the portfolio level. The frontend (`App.tsx` / `StatsGrid.tsx`) will then display this new data field.

**Tech Stack:** Node.js (Express), Prisma, React, TypeScript.

---

### Task 1: Backend - MarketDataService Update

**Files:**
- Modify: `backend/src/services/market-data.service.ts`

- [ ] **Step 1: Write the failing test** (If test file exists for market data service, else write it directly. We'll assume direct implementation since we need to add a Prisma query). Add the new method to the service.

```typescript
  public static async getPreviousNAV(amfiCode: string, beforeDate: Date = new Date()): Promise<number> {
    const previousNAV = await prisma.historicalNAV.findFirst({
      where: {
        amfiCode: amfiCode,
        date: {
          lt: beforeDate
        }
      },
      orderBy: {
        date: 'desc'
      }
    });

    return previousNAV ? previousNAV.nav : 0;
  }
```

- [ ] **Step 2: Save the file.**

### Task 2: Backend - Portfolio Route Update

**Files:**
- Modify: `backend/src/routes/portfolio.routes.ts`

- [ ] **Step 1: Update the portfolio summary mapping logic.** Around the area where `MarketDataService.getLatestNAV` is called for `liveNav`.

```typescript
      const liveNav = await MarketDataService.getLatestNAV(folio.asset.amfiCode || '');
      // NEW: Get previous NAV
      const previousNav = await MarketDataService.getPreviousNAV(folio.asset.amfiCode || '', new Date());
      const lastNav = PortfolioUtils.getLatestNAV(folio.transactions);
      const currentPrice = liveNav > 0 ? liveNav : lastNav;
      const prevPrice = previousNav > 0 ? previousNav : lastNav;
      
      const totalUnits = folio.transactions.reduce((acc, t) => acc + (t.type === 'BUY' ? t.units : -t.units), 0);
      const dayChange = (currentPrice - prevPrice) * totalUnits;
```

- [ ] **Step 2: Update the `summaries` return object.** Pass `dayChange` up from the `TaxService.calculatePortfolioTax` or attach it to the `folio` object. Since `calculatePortfolioTax` might not expect `dayChange`, append it to the map result:

```typescript
      const taxSummary = TaxService.calculatePortfolioTax(
        folio.asset.name,
        folio.asset.type,
        folio.transactions,
        currentPrice,
        slabValue
      );
      
      return {
        ...taxSummary,
        dayChange,
        dayChangePercentage: prevPrice > 0 ? ((currentPrice - prevPrice) / prevPrice) * 100 : 0
      };
```

- [ ] **Step 3: Update the `aggregate` object.** Add `dayChange` to the response payload.

```typescript
    const aggregate = {
      realized: { /* ... */ },
      unrealized: { /* ... */ },
      details: summaries.flatMap(s => s.realized.details).sort((a, b) => new Date(b.sellDate).getTime() - new Date(a.sellDate).getTime()),
      dayChange: {
        total: summaries.reduce((acc, s) => acc + (s as any).dayChange, 0),
        // Weighted percentage can be calculated on the frontend or aggregated here
      }
    };
```

### Task 3: Frontend - UI Updates

**Files:**
- Modify: `frontend/src/components/Dashboard/StatsGrid.tsx`
- Modify: `frontend/src/App.tsx` (or where the asset list is rendered)

- [ ] **Step 1: Update the Portfolio Header (`StatsGrid.tsx`).** Extract the new `dayChange` value from the API response props and render it.

```tsx
  // Inside StatsGrid or wherever the total is displayed
  <div className="stat-card">
    <h3>1-Day Change</h3>
    <p style={{ color: data.dayChange.total >= 0 ? 'var(--success-color)' : 'var(--error-color)' }}>
      {data.dayChange.total >= 0 ? '+' : ''}₹{Math.abs(data.dayChange.total).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
    </p>
  </div>
```

- [ ] **Step 2: Update individual asset rows.** Map over the portfolios and display the day change for each folio if applicable (this requires passing `dayChange` down to the `details` or rendering it in the list).

- [ ] **Step 3: Test and Commit.** Verify the UI properly handles positive, negative, and zero day changes.
```bash
git add backend/src/services/market-data.service.ts backend/src/routes/portfolio.routes.ts frontend/src/components/Dashboard/StatsGrid.tsx frontend/src/App.tsx
git commit -m "feat: add 1-Day change tracking to portfolio"
```
