# Tax Optimization & Schedule CG ITR Reporting

## Executive Overview
The Portfolio Tracker provides an institutional-grade tax optimization and capital gains engine customized for Indian direct tax laws, empowering investors and Chartered Accountants (CAs) to maximize post-tax returns, harvest tax exemptions, and export audit-ready ITR-2 and ITR-3 reports.

---

## Key Capabilities

### 1. Budget 2024 (Finance (No. 2) Act, 2024) Real-Time Compliance
- **Dynamic Date Bounded Rates:**
  - Automatically segregates sales realized before **23 July 2024** (STCG @ 15%, LTCG @ 10%) from sales on or after **23 July 2024** (STCG @ 20%, LTCG @ 12.5%).
- **Enhanced Section 112A Exemption Tracker:**
  - Tracks the statutory exemption limit (₹1,00,000 for FY $\le$ 2023-24; **₹1,25,000** for FY 2024-25+).
  - Uses sequential exhaustion (exhausting gains against the 10% tranche first before applying to the 12.5% tranche) to provide statutory tax minimization.
- **Section 50AA Classification:**
  - Automatically isolates Specified Mutual Funds acquired after 31 March 2023, treating them as deemed STCG taxed at marginal slab rates.
- **Grandfathered Debt Funds:**
  - Retains indexation / grandfathered status for debt funds acquired prior to 1 April 2023, applying revised 24-month thresholds and 12.5% unindexed rates for post-July 2024 transfers.

---

### 2. Schedule CG Table F: Advance Tax Accrual Matrix
- Accurately bins capital gains across the 6 statutory quarterly windows (Q1, Q2a, Q2b, Q3, Q4, Q5).
- Displays estimated tax liabilities across each period to help taxpayers pay advance tax accurately and avoid interest penalizations under **Section 234C**.

---

### 3. Comprehensive CA-Ready CSV Export (Schedule CG Audit Standard)
- Generates a multi-section, 27-column audit CSV ready for ingestion into tax preparation suites (ClearTax, Winman, CompuTax, Genius) or filing directly via the Income Tax offline utility.
- **Header Metadata:** Assessee Name, PAN, Financial Year, Assessment Year, Gross Consideration, Total Cost, Transfer Expenses, Section 111A/112A Totals, Exemption Claimed, Base Tax, 4% Health & Education Cess, and Total Tax.
- **Embedded Schedule CG Table F Matrix:** Quarterly breakdown of capital gains by section.
- **Scrip-wise Schedule (27 Columns):** Detailed lot-by-lot reconciliation including Folio Number, ISIN, Scheme Name, Units, Buy/Sell NAVs, Cost of Acquisition, FMV as on 31-Jan-2018, Deemed Cost u/s 55(2)(ac), Exit Load, Net Gain, Cess, and Data Reliability Warnings.

---

### 4. Tax-Loss & LTCG Tax Harvesting
- Identifies unrealized gains up to the remaining annual Section 112A exemption threshold to enable tax-free realization and portfolio rebalancing.
- Simulates sell orders with real-time exit load deductions, ELSS lock-in verification (3 years), and 4% Health & Education Cess inclusion.
