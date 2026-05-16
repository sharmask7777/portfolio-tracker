# SOP: Agentic Evaluation of Portfolio Reporting Accuracy

This SOP defines the protocol for an agent to evaluate, diagnose, and verify the accuracy of financial reports (Invested, Net Worth, XIRR) within the Portfolio Tracker. It is designed to be triggered whenever a user reports "wild" numbers or "zero" values.

## 1. Automated Anomaly Detection

Before requesting user data, run a script to scan the database for obvious mathematical "red flags":

### Anomaly Checklist:
- [ ] **XIRR > 100%:** High probability of "Time Compression" (short window annualization).
- [ ] **Invested == 0 AND Current Value > 0:** Missing cost basis or failed "Anchor" injection.
- [ ] **Invested != 0 AND Current Units == 0:** Basis erasure bug. Closed positions MUST show ₹0 invested to keep the active view clean.
- [ ] **Net Worth < 0:** Invalid transaction signs (Redemptions/Charges recorded as purchases).
- [ ] **Missing Opening Balance:** If a fund has an `OPENING_BALANCE` but 0 STCG/LTCG in simulations, the parser or tax engine is skipping the opening lot.
- [ ] **Duplicate Folios:** Same scheme appearing in multiple rows (Sync collision).
- [ ] **Ghost Balance:** If `Current Units > 0` but the fund is redeemed, check if the last transaction was an auxiliary tax/duty record with 0 balance that was incorrectly used as the "latest balance".

### Detection Command:
```bash
cd backend && ./node_modules/.bin/ts-node -e "
import { prisma } from './src/services/db.service';
import { PerformanceService } from './src/services/performance.service';
import { PortfolioUtils } from './src/utils/portfolio.utils';
// Script to iterate all folios and print 'RED FLAG' for any above criteria
"
```

## 2. Synthetic Stress Testing (Mock Eval)

If logic errors are suspected, use the `MockCASGenerator` to create a controlled environment.

1.  **Generate Edge-Case Data:**
    ```typescript
    const mock = MockCASGenerator.generate({ 
       numFolios: 5, 
       includeEdgeCases: true // Ensure it generates summary-only AND detailed schemes
    });
    ```
2.  **Run Isolated Sync:** Ingest into a dedicated `eval-user-xyz` account.
3.  **Tally Invariants:**
    - `Invested Amount` MUST equal the sum of all `PURCHASE` amounts + `ANCHOR` cost.
    - `Total Units` MUST match the latest PDF `close` units exactly.

## 3. Real Statement "Ground-Truth" Tally

When a real user statement is provided, follow this mandatory multimodal/text tally protocol:

1.  **Multimodal Inspection:** Directly read the "Portfolio Summary" table in the PDF. Record:
    - `Scheme Name` | `Cost Value` | `Market Value`
2.  **Parser Comparison:** Run the Python bridge and compare the JSON `valuation` object for that scheme.
    ```bash
    ./venv/bin/python3 scripts/parse_cas.py <path> <pass> | grep -A 10 "<scheme_name>"
    ```
3.  **The "Sync Leak" Check:** Verify if transactions are "leaking" to other users or if different folio number formats (e.g. `123` vs `123 / 0`) are creating duplicates.

## 4. Remediation & Verification Cycle

### Step A: Implementation Fix
- **If XIRR is high:** Check `Anchor Date` in `SyncService.ts` and `diffDays` in `PerformanceService.ts`.
- **If Invested is 0:** Verify `ANCHOR` generation logic for that specific statement type.

### Step B: The "Clean Room" Sync
Always verify a fix by wiping the test user and re-syncing:
1. `DELETE FROM "Transaction" WHERE ...`
2. `SyncService.syncPortfolio(...)`
3. Run the **Metric Tally Script** (see `SOP_CAS_ADAPTATION.md`).

## 5. Exit Criteria (The "Sorted" State)
An evaluation is only complete when:
1.  **Zero Duplicates:** Each fund appears exactly once in the dashboard.
2.  **Sane XIRR:** All XIRR values are between -100% and +100% (unless verified otherwise by PDF).
3.  **Lot Integrity:** The sum of units in the database matches the PDF closing units to 3 decimal places.
4.  **Auxiliary Neutrality:** Unit balances and NAVs are NEVER derived from `STAMP_DUTY_TAX`, `STT_TAX`, or `CHARGE` transactions.
5.  **FY Accuracy:** Realized gains and tax exemptions (1L vs 1.25L) correctly shift based on the selected Financial Year (Budget 2024 compliance).
6.  **Idempotency:** Re-uploading the exact same PDF results in **0 new database records**.

---
*Created: May 2026 | Standard: Strands Financial Integrity Protocol*
