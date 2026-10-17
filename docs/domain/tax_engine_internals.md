# Tax Engine Internals

## Statutory Regulatory Framework
The portfolio tracker's tax engine is architected in strict compliance with the **Income Tax Act, 1961**, amended by the **Finance (No. 2) Act, 2024** (enacted July 2024), and CBDT guidelines for filing **ITR-2 and ITR-3 (Schedule CG - Capital Gains)**.

---

## 1. Statutory Accounting & FIFO Allocation
Under Section 45(2AA) and CBDT circulars, capital gains from the redemption or transfer of mutual fund units and dematerialized securities are computed strictly on a **First-In, First-Out (FIFO)** lot allocation basis.
- Buy lots are tracked chronologically per folio.
- Bonus units are ingested with a cost basis of ₹0.
- Switch-ins, SIPs, and reinvestments establish distinct cost and holding-period anchors.
- When redemptions occur, units are exhausted from the earliest available lot until fulfilled.

---

## 2. Budget 2024 (Finance (No. 2) Act, 2024) Provisions & Cutoff Rules
The Finance (No. 2) Act, 2024 introduced radical changes to the Indian capital gains tax regime effective for all transfers made on or after **23 July 2024**. The engine implements exact calendar-date bifurcation:

### A. Listed Equity & Equity-Oriented Mutual Funds (STT Paid)
- **Holding Period Threshold:** 12 months (365 calendar days).
- **Section 111A (STCG):**
  - Transfers up to **22 July 2024:** Taxed at **15%** base rate (+ 4% Cess = **15.60%**).
  - Transfers on or after **23 July 2024:** Taxed at **20%** base rate (+ 4% Cess = **20.80%**).
- **Section 112A (LTCG):**
  - Transfers up to **22 July 2024:** Taxed at **10%** base rate (+ 4% Cess = **10.40%**).
  - Transfers on or after **23 July 2024:** Taxed at **12.5%** base rate (+ 4% Cess = **13.00%**).
- **Section 112A Statutory Exemption Limit:**
  - Up to FY 2023-24: ₹1,00,000 per financial year.
  - From **FY 2024-25 onwards:** Raised to **₹1,25,000** per financial year.
- **Statutory Exemption Exhaustion Sequencing:**
  When an assessee realizes Section 112A gains across both tranches in FY 2024-25 (pre-23 July @ 10% and post-23 July @ 12.5%), the statutory exemption is **sequentially exhausted first against the 10% tranche**, with any remaining exemption applied to the 12.5% tranche. Weighted-average blending is not permitted under CBDT rules.

### B. Specified Mutual Funds (Section 50AA) & Debt Funds
- **Section 50AA:** For mutual funds where equity exposure is $\le 35\%$ acquired on or after **1 April 2023**, all capital gains are statutorily deemed to be **Short-Term Capital Gains**, taxable at the individual's applicable income tax slab rate regardless of holding duration.
- **Grandfathered Debt Funds (Acquired before 1 April 2023):**
  - Transfers up to **22 July 2024:** If held $\ge 36$ months (1095 days), taxed under Section 112 at **20% with Cost Inflation Index (CII)** benefit. If held $< 36$ months, taxed at slab rates.
  - Transfers on or after **23 July 2024:** Holding period threshold standardized to **24 months** (730 days). If held $\ge 24$ months, taxed under Section 112 at **12.5% without indexation**. If held $< 24$ months, taxed at slab rates.

---

## 3. Section 55(2)(ac) Grandfathering Mechanism (Pre-2018 Equity)
For equity shares and equity-oriented mutual fund units acquired on or before **31 January 2018**:
1. Statutory Fair Market Value (FMV) is looked up from `HistoricalNAV` on `2018-01-31` (closing NAV).
2. The Deemed Cost of Acquisition is computed per Section 55(2)(ac):
   $$\text{Step 1: } V_1 = \min(\text{FMV as on 31-Jan-2018},\, \text{Full Value of Consideration})$$
   $$\text{Step 2: } \text{Deemed Cost of Acquisition} = \max(\text{Actual Cost of Acquisition},\, V_1)$$
3. Transfer expenses (exit loads, allowable fees) are deducted u/s 48(i):
   $$\text{Net Realized Gain / (Loss)} = \text{Gross Consideration} - \text{Deemed Cost of Acquisition} - \text{Transfer Expenses}$$

---

## 4. Statutory Deductions under Section 48
Expenditure incurred wholly and exclusively in connection with the transfer (such as mutual fund exit loads) is deductible under Section 48(i) from gross consideration when computing net capital gains.

---

## 5. Health & Education Cess (4%)
Per Section 115JB / Chapter II of the Finance Act, a mandatory **4% Health and Education Cess** is computed and applied across all capital gains tax liabilities (Sections 111A, 112A, 112, and 50AA).

---

## 6. Schedule CG Table F: Advance Tax Accrual Matrix (Section 234C)
To accurately compute interest on deferment of advance tax under Section 234C, capital gains must be reported in Schedule CG, Table F across 6 statutory periods for FY 2024-25:
- **Q1:** 01-Apr to 15-Jun (Due date: 15 June)
- **Q2a (Pre-Budget):** 16-Jun to 22-Jul (Due date: 15 September)
- **Q2b (Post-Budget):** 23-Jul to 15-Sep (Due date: 15 September)
- **Q3:** 16-Sep to 15-Dec (Due date: 15 December)
- **Q4:** 16-Dec to 15-Mar (Due date: 15 March)
- **Q5:** 16-Mar to 31-Mar (Due date: 31 March)

---

## 7. Standardized 27-Column CA Audit CSV Report
The export engine generates a dual-section CSV format containing:
1. **Statutory Metadata & Table F Header:** Assessee PAN, Name, FY, AY, Gross Consideration, Total Cost, Section 111A/112A breakdown, Exemption claimed, and the complete Table F quarterly matrix.
2. **Master Scrip-wise Schedule (27 Columns):**
   - Sr. No., Folio Number, ISIN, Asset / Scheme Name, Asset Class, Tax Section, Buy Date, Sell Date, Holding Period (Days), Holding Type, Units, Buy NAV, Sell NAV, Gross Consideration, Cost of Acquisition, FMV 2018 NAV, Total FMV 2018, Deemed Cost u/s 55(2)(ac), Transfer Expenses / Exit Load, Net Capital Gain / (Loss), Tax Rate (%), Tax Before Cess, Health & Education Cess (4%), Total Tax Payable, Advance Tax Quarter, Grandfathered Flag, Anchor / Estimate Warning.
