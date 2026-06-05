# Ability to Sort Scheme Table Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement sorting for the Scheme Breakdown table columns (Scheme Name, Type, Invested, Current Value, Day Change, XIRR/Return, Post-Tax XIRR/Return) cycling through Unsorted ➔ Descending (↓) ➔ Ascending (↑).

**Architecture:** Create a pure sorting utility `sorting.ts` to perform frontend-only sorting of folio data. Add sorting state (`sortField`, `sortDirection`) to `App.tsx`, and hook it up to the table header UI and rows.

**Tech Stack:** React, TypeScript, Vitest, Lucide React

---

### Task 1: Create Sorting Utility and Unit Tests

**Files:**
- Create: `frontend/src/utils/sorting.ts`
- Create: `frontend/src/utils/sorting.test.ts`

- [ ] **Step 1: Write the sorting utility tests**
  Create `frontend/src/utils/sorting.test.ts` containing tests for all columns, ascending/descending directions, null sorting, and performance mode switching.

```typescript
import { describe, it, expect } from 'vitest';
import { sortFolios, SortField, SortDirection } from './sorting';

describe('sortFolios', () => {
  const mockFolios = [
    {
      id: '1',
      asset: { name: 'Axis Bluechip', type: 'MUTUAL_FUND' },
      metrics: { investedAmount: 10000, currentValue: 12000, dayChange: 100, xirr: 0.15, postTaxXirr: 0.12, absoluteReturn: 0.2, postTaxAbsoluteReturn: 0.16 }
    },
    {
      id: '2',
      asset: { name: 'HDFC Equity', type: 'ETF' },
      metrics: { investedAmount: 5000, currentValue: 8000, dayChange: -50, xirr: 0.25, postTaxXirr: 0.20, absoluteReturn: 0.6, postTaxAbsoluteReturn: 0.48 }
    }
  ];

  it('returns original array when sortField or sortDirection is null', () => {
    const result = sortFolios(mockFolios, null, null, 'XIRR');
    expect(result).toEqual(mockFolios);
  });

  it('sorts by scheme name', () => {
    const sortedDesc = sortFolios(mockFolios, 'name', 'desc', 'XIRR');
    expect(sortedDesc[0].asset.name).toBe('HDFC Equity');

    const sortedAsc = sortFolios(mockFolios, 'name', 'asc', 'XIRR');
    expect(sortedAsc[0].asset.name).toBe('Axis Bluechip');
  });

  it('sorts by invested amount', () => {
    const sortedDesc = sortFolios(mockFolios, 'invested', 'desc', 'XIRR');
    expect(sortedDesc[0].metrics.investedAmount).toBe(10000);

    const sortedAsc = sortFolios(mockFolios, 'invested', 'asc', 'XIRR');
    expect(sortedAsc[0].metrics.investedAmount).toBe(5000);
  });

  it('sorts by current value', () => {
    const sortedDesc = sortFolios(mockFolios, 'value', 'desc', 'XIRR');
    expect(sortedDesc[0].metrics.currentValue).toBe(12000);
  });

  it('sorts by performance (XIRR mode)', () => {
    const sortedDesc = sortFolios(mockFolios, 'performance', 'desc', 'XIRR');
    expect(sortedDesc[0].metrics.xirr).toBe(0.25);
  });

  it('sorts by performance (ABS mode)', () => {
    const sortedDesc = sortFolios(mockFolios, 'performance', 'desc', 'ABS');
    expect(sortedDesc[0].metrics.absoluteReturn).toBe(0.6);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
  Run: `npm run test:unit --prefix frontend`
  Expected: FAIL (Cannot find module './sorting' or compilation error)

- [ ] **Step 3: Implement minimal sorting code**
  Create `frontend/src/utils/sorting.ts`:

```typescript
export type SortField = 'name' | 'type' | 'invested' | 'value' | 'dayChange' | 'performance' | 'postTaxPerformance';
export type SortDirection = 'asc' | 'desc';

export function sortFolios(
  folios: any[],
  sortField: SortField | null,
  sortDirection: SortDirection | null,
  performanceMode: 'XIRR' | 'ABS'
): any[] {
  if (!folios) return [];
  const foliosCopy = [...folios];
  if (!sortField || !sortDirection) return foliosCopy;

  return foliosCopy.sort((a, b) => {
    let aVal: any;
    let bVal: any;

    switch (sortField) {
      case 'name':
        aVal = a.asset?.name?.toLowerCase() || '';
        bVal = b.asset?.name?.toLowerCase() || '';
        break;
      case 'type':
        aVal = a.asset?.type?.toLowerCase() || '';
        bVal = b.asset?.type?.toLowerCase() || '';
        break;
      case 'invested':
        aVal = a.metrics?.investedAmount ?? 0;
        bVal = b.metrics?.investedAmount ?? 0;
        break;
      case 'value':
        aVal = a.metrics?.currentValue ?? 0;
        bVal = b.metrics?.currentValue ?? 0;
        break;
      case 'dayChange':
        aVal = a.metrics?.dayChange ?? 0;
        bVal = b.metrics?.dayChange ?? 0;
        break;
      case 'performance':
        aVal = performanceMode === 'XIRR' ? (a.metrics?.xirr ?? 0) : (a.metrics?.absoluteReturn ?? 0);
        bVal = performanceMode === 'XIRR' ? (b.metrics?.xirr ?? 0) : (b.metrics?.absoluteReturn ?? 0);
        break;
      case 'postTaxPerformance':
        aVal = performanceMode === 'XIRR' ? (a.metrics?.postTaxXirr ?? 0) : (a.metrics?.postTaxAbsoluteReturn ?? 0);
        bVal = performanceMode === 'XIRR' ? (b.metrics?.postTaxXirr ?? 0) : (b.metrics?.postTaxAbsoluteReturn ?? 0);
        break;
      default:
        return 0;
    }

    if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });
}
```

- [ ] **Step 4: Run test to verify it passes**
  Run: `npm run test:unit --prefix frontend`
  Expected: PASS

- [ ] **Step 5: Commit utility**
  Run:
  ```bash
  git add frontend/src/utils/sorting.ts frontend/src/utils/sorting.test.ts
  git commit -m "feat: add sortFolios utility and tests"
  ```

---

### Task 2: Integrate Sorting State and Click Handlers in Dashboard

**Files:**
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Write integration tests or check App structure**
  We will verify we can import our sorting logic and set up state. Let's make sure our typescript builds without issues.
  Run: `npm run build --prefix frontend`
  Expected: PASS (no changes made yet)

- [ ] **Step 2: Add sorting state and Lucide imports to `App.tsx`**
  Modify imports at the top to add `ArrowUp`, `ArrowDown`, `ArrowUpDown` if they are not there:
  ```typescript
  // Modify frontend/src/App.tsx line 24 to add ArrowUp, ArrowDown, ArrowUpDown
  ```
  Add the state hooks and handler inside the `Dashboard` component (around line 66):
  ```typescript
  const [sortField, setSortField] = useState<SortField | null>('value');
  const [sortDirection, setSortDirection] = useState<SortDirection | null>('desc');

  const handleSort = (field: SortField) => {
    if (sortField !== field) {
      setSortField(field);
      setSortDirection('desc');
    } else {
      if (sortDirection === 'desc') {
        setSortDirection('asc');
      } else if (sortDirection === 'asc') {
        setSortField(null);
        setSortDirection(null);
      } else {
        setSortField(field);
        setSortDirection('desc');
      }
    }
  };
  ```

- [ ] **Step 3: Modify Scheme breakdown table headers and body**
  Update the table header `<th>` tags to call `handleSort` and display sort indicator icons. Update the `tbody` mapping to sort folios before rendering:
  ```typescript
  const sortedFolios = sortFolios(portfolio.folios, sortField, sortDirection, performanceMode);
  ```

- [ ] **Step 4: Verify type safety and build**
  Run: `npm run build --prefix frontend`
  Expected: PASS

- [ ] **Step 5: Run unit tests**
  Run: `npm run test:unit --prefix frontend`
  Expected: PASS

- [ ] **Step 6: Commit integration**
  Run:
  ```bash
  git add frontend/src/App.tsx
  git commit -m "feat: integrate sorting state and interactive headers in scheme breakdown table"
  ```
