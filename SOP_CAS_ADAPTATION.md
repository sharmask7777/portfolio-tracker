# SOP: CAS PDF Adaptation & Ingestion Validation

This Standard Operating Procedure (SOP) guides agents through the process of adapting the Portfolio Tracker ingestion engine when RTA (CAMS/KFintech) PDF formats change or when parsing discrepancies are reported.

## 1. Detection & Diagnostic Phase

### Signs of Failure
- **Parsing Error:** "Upload failed" or specific Python errors (e.g., `Decimal is not JSON serializable`).
- **Data Inversion:** Invested amount is higher than Net Worth for a profitable portfolio.
- **Data Corruption:** Multiple rows for the same scheme in the UI.
- **Zero Values:** Schemes listed with ₹0 invested or ₹0 value despite having holdings.

### Initial Logs Check
1. Check backend logs for Python stderr:
   ```bash
   # Look for "Python parser process exited with code 1"
   # Look for "TypeError: Object of type Decimal is not JSON serializable"
   ```
2. Verify the raw output of the parser:
   ```bash
   cd backend && ./venv/bin/python3 scripts/parse_cas.py <pdf_path> <password> > diagnostic.json
   ```

## 2. Ground Truth Extraction (Manual Tally)

Never trust the parser alone during a failure. Establish a "Ground Truth" by extracting raw text.

1. **Raw Text Dump:**
   ```bash
   ./venv/bin/python3 ./venv/bin/pdf2txt.py -P <password> <pdf_path> | head -n 500
   ```
2. **Tally Checklist:**
   - [ ] **Units:** Find the "Closing Balance" in the text for 2-3 schemes.
   - [ ] **Cost Basis:** Find the "Cost Value" or "Valuation Cost" in the PDF Portfolio Summary.
   - [ ] **Transactions:** Verify if SIPs/Redemptions are listed in the text.

## 3. Implementation Adaptation

### A. Python Bridge (`parse_cas.py`)
- **Serialization:** Ensure the `CASDataEncoder` handles `decimal.Decimal` and `datetime.date`.
- **Key Mapping:** RTAs often change keys like `investor` vs `investor_info` or `scheme` vs `name`. Normalize these in the Python script to keep `SyncService` stable.

### B. Sync Logic (`SyncService.ts`)
- **Summary statements:** If `transactions` is empty but `close` > 0, inject a `BALANCE_STMT` transaction.
- **Detailed statements:** If `open` > 0, inject an `OPENING_BALANCE` transaction using `valuation.cost` minus the period's purchases.
- **Deduplication:** The `externalId` must be `${portfolioId}-${folioNumber}-${isin}-${date}-${type}-${amount}-${units}-${nav}-${balance}` to prevent cross-user collisions and handle SIP duplicates.

### C. Performance Engine (`PerformanceService.ts`)
- **Inclusion:** Ensure `BALANCE_STMT` and `OPENING_BALANCE` are treated as **outflows** (investments) in `investedAmount` and `XIRR` calculations.
- **Stability:** Cap XIRR at 1000% and return 0% for durations < 1 day to prevent astronomical values in summary-only imports.

## 4. Rigorous Validation Protocol

### Step 1: The "Flush & Sync" Test
To verify the fix without noise from previous attempts:
1. Purge the test user's data from the DB.
2. Run a fresh sync using the problematic PDF.
3. Count transactions: `SELECT count(*) FROM "Transaction" WHERE "folioId" IN (...)`.

### Step 2: Metric Tally
Run a Node.js script to calculate metrics for a specific folio and compare with the PDF:
```typescript
const metrics = PerformanceService.getMetrics(txs, currentPrice, currentUnits);
// Tally metrics.investedAmount against PDF Cost Value
// Tally metrics.currentValue against PDF Market Value
```

### Step 3: Idempotency Check
Upload the same PDF twice. The transaction count MUST NOT increase.

## 5. Maintenance of Test Artifacts
- **MockCASGenerator:** If a new PDF field is introduced, update `MockCASGenerator.ts` and the `MockCAS` interface.
- **SyncService Tests:** Add a new test case in `sync.service.spec.ts` simulating the new format.

---
*Created: May 2026 | Mandate: Absolute Accuracy in Financial Reporting*
