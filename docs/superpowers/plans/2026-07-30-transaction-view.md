# Transaction Side Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provide a side panel that slides out when clicking a mutual fund row in the portfolio table, displaying its full transaction history.

**Architecture:** We will create a `TransactionSidePanel` React component that accepts a `folio` and `onClose` callback. The `App.tsx` file will manage a `selectedFolioForTransactions` state variable and pass it to the panel. Click events on the mutual fund rows will set this state.

**Tech Stack:** React, TypeScript, Vitest, CSS.

---

### Task 1: Create TransactionSidePanel Component

**Files:**
- Create: `frontend/src/components/Dashboard/TransactionSidePanel.tsx`
- Create: `frontend/src/components/Dashboard/TransactionSidePanel.test.tsx`
- Modify: `frontend/src/index.css` (for slide-out animations and styles)

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TransactionSidePanel } from './TransactionSidePanel';

describe('TransactionSidePanel', () => {
  const mockFolio = {
    id: '1',
    asset: { name: 'Test Fund' },
    transactions: [
      { id: 't1', date: '2023-01-01', type: 'Buy', amount: 1000, units: 100, nav: 10 },
      { id: 't2', date: '2023-02-01', type: 'Sell', amount: -500, units: -40, nav: 12.5 },
    ]
  };

  it('renders nothing when folio is null', () => {
    const { container } = render(<TransactionSidePanel folio={null} onClose={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders transactions when folio is provided', () => {
    render(<TransactionSidePanel folio={mockFolio} onClose={vi.fn()} />);
    expect(screen.getByText('Test Fund')).toBeInTheDocument();
    expect(screen.getByText('Buy')).toBeInTheDocument();
    expect(screen.getByText('Sell')).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn();
    render(<TransactionSidePanel folio={mockFolio} onClose={onClose} />);
    fireEvent.click(screen.getByLabelText('Close panel'));
    expect(onClose).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm run test:unit -- src/components/Dashboard/TransactionSidePanel.test.tsx`
Expected: FAIL because `TransactionSidePanel` does not exist yet.

- [ ] **Step 3: Write minimal implementation**

Modify `frontend/src/index.css` to append these styles at the bottom:
```css
.side-panel-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.5);
  z-index: 1000;
  display: flex;
  justify-content: flex-end;
}
.side-panel {
  width: 100%;
  max-width: 400px;
  background: var(--bg-color);
  height: 100%;
  box-shadow: -2px 0 10px rgba(0,0,0,0.1);
  animation: slideIn 0.3s ease-out;
  display: flex;
  flex-direction: column;
}
@keyframes slideIn {
  from { transform: translateX(100%); }
  to { transform: translateX(0); }
}
.side-panel-header {
  padding: 1rem;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.side-panel-content {
  padding: 1rem;
  overflow-y: auto;
  flex: 1;
}
.transaction-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.transaction-item {
  padding: 1rem;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  display: flex;
  justify-content: space-between;
}
```

Create `frontend/src/components/Dashboard/TransactionSidePanel.tsx`:
```tsx
import React from 'react';
import { X } from 'lucide-react';

export function TransactionSidePanel({ folio, onClose }: { folio: any, onClose: () => void }) {
  if (!folio) return null;

  return (
    <div className="side-panel-overlay" onClick={onClose}>
      <div className="side-panel" onClick={(e) => e.stopPropagation()}>
        <div className="side-panel-header">
          <h2 style={{ margin: 0, fontSize: '1.25rem' }}>{folio.asset.name}</h2>
          <button aria-label="Close panel" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
            <X />
          </button>
        </div>
        <div className="side-panel-content">
          <h3>Transactions</h3>
          <div className="transaction-list">
            {folio.transactions?.map((tx: any, idx: number) => (
              <div key={tx.id || idx} className="transaction-item">
                <div>
                  <strong>{tx.type}</strong>
                  <div style={{ fontSize: '0.85rem', color: 'gray' }}>
                    {new Date(tx.date).toLocaleDateString()}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div>₹{Math.abs(tx.amount).toLocaleString()}</div>
                  <div style={{ fontSize: '0.85rem', color: 'gray' }}>
                    {Math.abs(tx.units)} units @ ₹{tx.nav}
                  </div>
                </div>
              </div>
            ))}
            {(!folio.transactions || folio.transactions.length === 0) && (
              <p>No transactions found.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npm run test:unit -- src/components/Dashboard/TransactionSidePanel.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/Dashboard/TransactionSidePanel.tsx frontend/src/components/Dashboard/TransactionSidePanel.test.tsx frontend/src/index.css
git commit -m "feat: add TransactionSidePanel component"
```

---

### Task 2: Integrate Panel in App.tsx

**Files:**
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Write the failing test**

*(We will rely on manual test verification via the browser here since App.tsx has many moving parts. No vitest unit tests are strictly required for this exact UI wire-up, we will execute standard React wiring)*

- [ ] **Step 2: Write minimal implementation**

Modify `frontend/src/App.tsx` using `replace_file_content` or `multi_replace_file_content`.

**Changes required in App.tsx:**
1. Import the component at the top:
   ```tsx
   import { TransactionSidePanel } from './components/Dashboard/TransactionSidePanel';
   ```
2. Add the state variable near the top of `function Dashboard()`:
   ```tsx
   const [selectedFolioForTransactions, setSelectedFolioForTransactions] = useState<any>(null);
   ```
3. Update the table row in `<tbody>` to add an onClick handler and style it to show cursor:pointer:
   Find:
   ```tsx
   <tr key={folio.id}>
     <td style={{ fontWeight: 500 }}>
       {folio.asset.name}
     </td>
   ```
   Replace with:
   ```tsx
   <tr key={folio.id}>
     <td 
       style={{ fontWeight: 500, cursor: 'pointer', textDecoration: 'underline' }} 
       onClick={() => setSelectedFolioForTransactions(folio)}
       title="Click to view transactions"
     >
       {folio.asset.name}
     </td>
   ```
4. Render the component at the bottom of the `<div className="app-container">` (e.g., right before `</main>` or similar appropriate level):
   ```tsx
   <TransactionSidePanel 
     folio={selectedFolioForTransactions} 
     onClose={() => setSelectedFolioForTransactions(null)} 
   />
   ```

- [ ] **Step 3: Run linter/build to verify types**

Run: `cd frontend && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add frontend/src/App.tsx
git commit -m "feat: wire up TransactionSidePanel in App"
```
