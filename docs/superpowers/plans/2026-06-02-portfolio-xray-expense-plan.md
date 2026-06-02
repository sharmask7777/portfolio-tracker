# Portfolio X-Ray Expense Enhancements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enhance the Portfolio X-Ray to show TER, Total Fees (annualized), Equity/Debt breakdown, and Active/Index/Arbitrage category breakdown.

**Architecture:** Modify `XRayService` to extract `expenseRatio` and `schemeCategory` from holdings data, calculate annualized fees per fund and aggregate them across defined categories. Update `XRayView.tsx` to display these metrics.

**Tech Stack:** React, Recharts, Node.js, Express, TypeScript.

---

### Task 1: Update Backend XRay Service Types & Engine

**Files:**
- Modify: `backend/src/services/xray.service.ts`
- Modify: `backend/src/services/xray.service.spec.ts`

- [ ] **Step 1: Write failing test in `xray.service.spec.ts`**

```typescript
// Add test in xray.service.spec.ts inside XRayService describe block
it('calculates expense analysis correctly', async () => {
  // Mock holdings data to include expenseRatio and schemeCategory
  // Mock total value and run getXRayData
  // Assert response contains expenseAnalysis with correct totalAnnualFees and category breakdown
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `cd backend && npm test src/services/xray.service.spec.ts`
Expected: FAIL

- [ ] **Step 3: Modify `xray.service.ts` to implement expense aggregation**

```typescript
// 1. Update XRayData interface at top of file
export interface XRayData {
  // ... existing ...
  expenseAnalysis: {
    totalAnnualFees: number;
    weightedAvgTer: number;
    categoryBreakdown: { category: string; totalFees: number; avgTer: number; percentage: number; value: number }[];
    fundBreakdown: { name: string; isin: string; category: string; ter: number; annualizedFee: number; value: number }[];
  };
  fundCategoryAllocation: {
    active: { percentage: number; value: number };
    index: { percentage: number; value: number };
    arbitrage: { percentage: number; value: number };
    other: { percentage: number; value: number };
  };
}

// 2. In getXRayData loop where holdings are processed, extract expenseRatio and schemeCategory
// Helper to parse category from schemeCategory string:
const parseCategory = (name: string, schemeCat: string) => {
  const lowerName = name.toLowerCase();
  const lowerCat = (schemeCat || '').toLowerCase();
  if (lowerName.includes('arbitrage') || lowerCat.includes('arbitrage')) return 'Arbitrage';
  if (lowerName.includes('index') || lowerCat.includes('index')) return 'Index';
  if (lowerCat.includes('international') || lowerCat.includes('global')) return 'International';
  return 'Active Equity';
};

// 3. Aggregate TER and calculate fees
let totalFees = 0;
const fundBreakdown = [];
const categoryFees: Record<string, { fee: number; terSum: number; value: number; count: number }> = {};
// Accumulate during the holdings processing loop...
```

- [ ] **Step 4: Run test to verify it passes**
Run: `cd backend && npm test src/services/xray.service.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add backend/src/services/xray.service.ts backend/src/services/xray.service.spec.ts
git commit -m "feat(backend): add expense analysis and fund category allocation to XRay API"
```

### Task 2: Update Frontend XRay View Component

**Files:**
- Modify: `frontend/src/components/Analytics/XRayView.tsx`

- [ ] **Step 1: Write failing test (if applicable) or proceed to implementation**
Since UI testing for React components here might rely on Cypress/Playwright, we will directly implement and visually verify.

- [ ] **Step 2: Update XRayView.tsx**

```tsx
// Inside XRayDashboard, add the new Expense Analysis section:
<div className="card" style={{ marginBottom: '1.5rem' }}>
  <h3>Expense Analysis</h3>
  <div style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}>
    <div style={{ background: 'var(--bg-secondary)', padding: '15px', borderRadius: '8px', flex: 1 }}>
      <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Total Fees Paid (Annualized)</div>
      <div style={{ fontSize: '24px', fontWeight: 'bold' }}>₹ {data.expenseAnalysis.totalAnnualFees.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
    </div>
    <div style={{ background: 'var(--bg-secondary)', padding: '15px', borderRadius: '8px', flex: 1 }}>
      <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Weighted Avg Expense Ratio</div>
      <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{data.expenseAnalysis.weightedAvgTer.toFixed(2)}%</div>
    </div>
  </div>
  
  <h4>Fund-wise Breakdown</h4>
  <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
    <thead>
      <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: '12px' }}>
        <th style={{ padding: '8px 0' }}>Fund Name</th>
        <th style={{ padding: '8px 0' }}>Category</th>
        <th style={{ padding: '8px 0' }}>TER</th>
        <th style={{ padding: '8px 0' }}>Annualized Fee</th>
      </tr>
    </thead>
    <tbody>
      {data.expenseAnalysis.fundBreakdown.map((f: any) => (
        <tr key={f.isin} style={{ borderBottom: '1px solid var(--border-color)' }}>
          <td style={{ padding: '8px 0' }}>{f.name}</td>
          <td style={{ padding: '8px 0', fontSize: '12px', color: 'var(--text-secondary)' }}>{f.category}</td>
          <td style={{ padding: '8px 0' }}>{f.ter.toFixed(2)}%</td>
          <td style={{ padding: '8px 0' }}>₹ {f.annualizedFee.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
        </tr>
      ))}
    </tbody>
  </table>
</div>
```

- [ ] **Step 3: Add Fund Category Breakdown UI**
Implement custom progress bar elements (as per mockup) for Asset Class Breakdown and Fund Category Breakdown in `XRayView.tsx`.

- [ ] **Step 4: Commit**
```bash
git add frontend/src/components/Analytics/XRayView.tsx
git commit -m "feat(frontend): display expense analysis and category breakdown in XRay"
```
