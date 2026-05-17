# Phase 8: Advanced Metrics: Post-Tax XIRR - Research

**Researched:** 2024-05-18
**Domain:** Fintech / Portfolio Analytics
**Confidence:** HIGH

## Summary

This phase introduces "Post-Tax" performance metrics to provide users with a "money-in-pocket" view of their investments. The core logic involves estimating the tax liability for each holding if it were sold at the current market price and then calculating performance metrics (XIRR and Absolute Return) using an adjusted current value.

**Primary recommendation:** Extend `TaxService` to calculate unrealized tax liability using a user-defined `taxSlab` (default 30%) for slab-taxed assets, and use this to derive Post-Tax Current Value for performance calculations.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Tax Calculation Logic | API / Backend | — | Complex tax rules (Budget 2024, Grandfathering) are best handled centrally. |
| XIRR / Performance Solver | API / Backend | — | Requires heavy computation and historical transaction sequences. |
| Tax Slab Configuration | Browser / Client | — | User preference stored in `localStorage` for privacy and ease of access. |
| Multi-mode UI Toggle | Browser / Client | — | Immediate UI feedback when switching between Pre-Tax and Post-Tax views. |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `node-irr` | 2.0.5 [VERIFIED] | XIRR Calculation | Robust solver for internal rate of return in Node.js. |
| `prisma` | 7.8.0 [VERIFIED] | Database Access | Type-safe transaction and folio retrieval. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|--------------|
| `lucide-react` | Latest [ASSUMED] | UI Icons | For calculator and shield icons in the table. |

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `node-irr` | npm | 8 yrs | ~2k/wk | [github.com/vanduynslagerp/node-irr](https://github.com/vanduynslagerp/node-irr) | [OK] | Approved |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### Recommended Project Structure
```
backend/src/
├── services/
│   ├── tax.service.ts         # [REFACTOR] Add unrealized tax estimation
│   ├── performance.service.ts # [STABLE] Core XIRR logic
└── routes/
    └── portfolio.routes.ts    # [EXTEND] Add taxSlab support to /summary
frontend/src/
├── contexts/
│   └── SettingsContext.tsx    # [EXTEND] Add taxSlab setting
├── components/
│   └── Dashboard/
│       └── Dashboard.tsx      # [EXTEND] Add Post-Tax column to table
```

### Pattern 1: Adjusted Terminal Flow for XIRR
**What:** Instead of using `CurrentValue` as the final flow in the XIRR sequence, use `CurrentValue - EstimatedTax`.
**When to use:** For all Post-Tax return calculations.
**Example:**
```typescript
// backend/src/services/performance.service.ts
public static calculatePostTaxXIRR(transactions, currentValue, estimatedTax) {
  const postTaxValue = currentValue - estimatedTax;
  return this.calculateXIRR(transactions, postTaxValue);
}
```

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| XIRR Solver | Custom Newton-Raphson | `node-irr` | Handling edge cases like multiple roots or non-convergent series. |
| Tax Rule Engine | Hardcoded logic in routes | `TaxService` | Centralizing logic for Budget 2024, grandfathering, and asset classification. |

## Common Pitfalls

### Pitfall 1: Ignoring 1.25L Exemption
**What goes wrong:** Post-tax metrics look overly pessimistic.
**Why it happens:** Indian tax law allows 1.25L LTCG exemption per year across all investments.
**How to avoid:** For individual holdings, it is standard to show "marginal" tax impact (ignoring the exemption) or pro-rating it. Decision D-02 implies a direct subtraction, which is the safest/most conservative approach.

### Pitfall 2: Slab Rate Application to Debt
**What goes wrong:** Incorrect tax rate for Debt Funds.
**Why it happens:** Debt funds bought after April 1, 2023, are always taxed at slab rates regardless of holding period.
**How to avoid:** Ensure `TaxService.getTaxType` correctly identifies `SLAB` assets and applies the user's `taxSlab`.

## Code Examples

### Calculating Unrealized Estimated Tax
```typescript
// Source: backend/src/services/tax.service.ts (Proposed Extension)
public static calculateUnrealizedTax(lots: BuyLot[], currentPrice: number, taxSlab: number): number {
  return lots.reduce((totalTax, lot) => {
    const gain = (currentPrice - lot.nav) * lot.units;
    if (gain <= 0) return totalTax;
    
    const taxType = this.getTaxType(lot.date, new Date(), assetType, assetName);
    const taxRate = this.getTaxRate(taxType, new Date(), assetType, assetName, taxSlab);
    return totalTax + (gain * taxRate);
  }, 0);
}
```

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `node-irr` is suitable for high-volume batch calculations | Standard Stack | Performance lag in the summary route. |
| A2 | Users prefer conservative tax estimation (no exemption) | Common Pitfalls | User perception of "incorrect" tax values. |
| A3 | `taxSlab` is applied globally to all `SLAB` assets | Summary | Over/under estimation if user has different slabs for different years. |

## Open Questions

1. **How to handle 1.25L LTCG Exemption?**
   - What we know: It exists globally.
   - What's unclear: Should we pro-rate it or ignore it for individual holdings?
   - Recommendation: Ignore it for individual holdings (most conservative) and focus on marginal impact.

2. **Should alternative assets like EPF/PPF be included in Post-Tax XIRR?**
   - What we know: PPF is tax-free (EEE). EPF is mostly tax-free.
   - What's unclear: Should we hardcode 0% tax for these?
   - Recommendation: Yes, `TaxService` should return 0% for PPF/EPF to ensure Pre-Tax and Post-Tax metrics match.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Backend Runtime | ✓ | v26.0.0 | — |
| Prisma | Data Access | ✓ | 7.8.0 | — |
| node-irr | XIRR Logic | ✓ | 2.0.5 | — |

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest |
| Config file | `backend/jest.config.js` |
| Quick run command | `npm test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TAX-01 | Estimate tax on current holdings | Unit | `npm test backend/src/services/tax.service.spec.ts` | ❌ |
| PERF-01 | Calculate Post-Tax XIRR | Unit | `npm test backend/src/services/performance.service.spec.ts` | ❌ |
| UI-01 | Toggle Post-Tax Column | E2E | `npx playwright test` | ❌ |

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V5 Input Validation | yes | Validate `taxSlab` is between 0 and 1. |

### Known Threat Patterns for Node.js/React

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Insecure Local Storage | Information Disclosure | Only store non-sensitive settings (like `taxSlab`) in `localStorage`. |

## Sources

### Primary (HIGH confidence)
- `backend/src/services/tax.service.ts` - Code analysis of existing tax logic.
- `backend/src/services/performance.service.ts` - Code analysis of XIRR logic.
- `CONTEXT.md` - Phase 8 decisions and scope.

### Tertiary (LOW confidence)
- WebSearch for latest Indian Tax Slab (Budget 2024) - Verified against internal `TaxService` implementation.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Libraries already in use.
- Architecture: HIGH - Follows existing service-oriented pattern.
- Pitfalls: MEDIUM - Tax complexity requires careful unit testing.

**Research date:** 2024-05-18
**Valid until:** 2024-06-18
