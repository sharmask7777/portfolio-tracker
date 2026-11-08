---
title: "Frictionless Section 112A Tax-Free Harvesting & SIP Lot Consolidation"
date: "2026-11-08"
category: "tax"
tags:
  - "tax-harvesting"
  - "section-112a"
  - "sip-lot-consolidation"
  - "knapsack-optimization"
  - "elss-guardrails"
  - "clipboard-resilience"
status: "verified"
---

# Frictionless Section 112A Tax-Free Harvesting & SIP Lot Consolidation

## 1. Problem Statement & Context

### 1.1 The 128-Step SIP Micro-Lot Explosion
In mutual fund systematic investment planning (SIP), long-term investors systematically accumulate dozens or hundreds of monthly purchase lots (e.g. 5–10 years across 3–4 schemes results in 100–300 distinct tax lots). Under statutory Indian income tax rules, long-term capital gains (LTCG) on equity-oriented mutual funds under **Section 112A** are tax-exempt up to **₹1,25,000** per financial year (indexed post-Budget 2024 from ₹1,00,000).

A naive tax harvesting algorithm iterates through individual purchase lots chronologically (FIFO), harvesting micro-lots one by one until the ₹1,25,000 threshold is exhausted. This generated instructions such as:
> *"1. Redeem 41.085 units of Scheme A... 2. Redeem 41.528 units of Scheme A... 128. Redeem 32.658 units of Scheme B..."*

### 1.2 The Platform & Statutory Friction
1. **Real-world RTA Execution:** Mutual fund execution portals (MF Central, CAMS, KFintech, Zerodha Coin, AMC portals) do not support lot-level redemptions. Redemptions are placed **strictly at the scheme and folio level** (either by total units or gross amount). RTAs automatically exhaust internal tax lots via FIFO under statutory rules. Requiring 128 redemption transactions is completely unviable for a human investor.
2. **Capital Turnover Inefficiency:** Naively picking the oldest chronological lots often harvests from schemes with low unrealized gain density (`gain / current_value`), requiring the investor to redeem ₹15,00,000+ of portfolio capital to harvest ₹1,25,000 of gain, triggering excessive out-of-market risk and transaction drag.
3. **The ELSS Reinvestment Trap:** If units harvested originate from an ELSS (Equity Linked Savings Scheme) whose mandatory 3-year statutory lock-in has expired, naively reinvesting back into the same ELSS imposes a **fresh 3-year lock-in** on harvested capital.
4. **Browser Clipboard Permissions:** In sandboxed iframe environments, local non-HTTPS testing, or browser permission restrictions, `navigator.clipboard.writeText` fails silently or throws a security exception, blocking users from obtaining their instructions.

---

## 2. Architecture & Algorithmic Solution

### 2.1 FIFO Lot Consolidation per Scheme & Folio
Instead of emitting lot-level instructions, the engine aggregates qualifying FIFO lots at the `(scheme_name, folio_id)` boundary:
- Units to redeem: $\sum \text{lot\_units}$
- Gross redemption value: $\text{Units to redeem} \times \text{Current NAV}$
- Tax-free gain harvested: $\sum \text{unrealized\_gain}_{\text{lot}}$

This collapses a 128-step instruction sheet into **1 to 3 atomic redemption orders**.

### 2.2 Gain-Density Greedy Knapsack Optimization
To minimize out-of-market capital turnover, the engine evaluates candidates across schemes and sorts them by **Gain Density**:
$$\text{Gain Density} = \frac{\text{Unrealized Gain}}{\text{Current Value}}$$

By greedily selecting schemes with the highest gain density:
- The investor harvests the full ₹1,25,000 Section 112A statutory allowance with the **least gross capital redeemed** (e.g. redeeming ₹2,50,000 with 50% gain density instead of ₹12,50,000 with 10% gain density).
- Portfolio exposure remains largely intact, minimizing market-timing risk during the settlement window.

### 2.3 Statutory Advisory & T+2 Reinvestment Protocols
The system generates a statutory compliance and reinvestment checklist:
- **T+2 Settlement Window:** Equity mutual fund redemptions settle into the investor's linked bank account on $T+2$ business days.
- **ELSS Anti-Lock-In Guardrail:** When harvesting from ELSS schemes, instructions explicitly direct the investor **NOT** to repurchase ELSS units. Instead, settled proceeds are directed into an open-ended broad equity fund (e.g. Nifty 50 Index Fund) to step up the acquisition cost basis to current NAV without locking up liquidity.
- **Statutory Cap Bound:** Total harvested LTCG is strictly bounded by $\min(\text{Available Gains}, ₹1,25,000 - \text{Already Realized Section 112A LTCG})$.

### 2.4 Resilient Multi-Tier UI Delivery
To ensure zero drop-off when copying instructions:
1. **Direct System Clipboard:** Tries `navigator.clipboard.writeText(formattedText)`.
2. **Fallback Modal Dialog:** If clipboard write is rejected or unavailable (e.g. non-HTTPS, missing browser permissions), the application catches the error and surfaces a dedicated `<SimulationModal>` with a full `<textarea readonly>` and instructions, allowing manual selection and copy.

---

## 3. Verification & Invariants

### 3.1 Domain Invariants
- **Statutory Exemption Bound:** $\sum \text{Harvested Gains} \le ₹1,25,000$.
- **Lot Parity:** The consolidated scheme units and gains exactly equal the sum of the underlying FIFO lots ($\Delta \text{Units} \le 0.0001, \Delta \text{Gain} \le ₹0.01$).
- **Zero Real PII:** All test vectors and mock portfolios use synthetic identifiers (`folio-ppfc`, `folio-debt`, `ABCDE1234F`).

### 3.2 Automated Test Coverage
- **Backend Domain (`portfolio-core`):** Pure in-memory unit tests in `crates/portfolio-core/src/tax/harvesting.rs` validating lot aggregation and gain-density knapsack sorting.
- **Frontend Unit Tests:** Verified via `pnpm --filter frontend test:unit`.
- **E2E Playwright Automation:**
  - `frontend/tests/reality-check.spec.ts`: Validates tax harvesting summary banner, execution modal opening, and lot consolidation verification.
  - `frontend/tests/analytics-reporting.spec.ts`: Validates consolidated instruction generation, action sheets, and clipboard resilience.
