# Phase 10: Family View & Alternative Assets - Research

**Researched:** 2026-05-20
**Domain:** Multi-member portfolio management, CAS auto-splitting, and aggregate performance metrics.
**Confidence:** HIGH

## Summary

This phase focuses on transitioning from a single-user portfolio tracker to a multi-member "Family View." The primary mechanism for this is **Managed Profiles**—identities that exist under the primary user's account without requiring separate logins. The system will leverage the PAN extraction capability of the `casparser` library to automatically split folios into these profiles during CAS ingestion.

**Primary recommendation:** Introduce a `ManagedProfile` entity to store PAN-to-Name mappings (e.g., "PAN: ABC...123" -> "Spouse") and update the `SyncService` to group folios into separate `Portfolio` records based on the extracted PAN.

## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01: Managed Profiles:** Profiles live entirely under the primary user's account. No separate logins or emails required.
- **D-02: Auto-Splitting:** Automatically detect unique PANs in CAS and create/assign folios to corresponding Managed Profiles.
- **D-03: Member Naming:** Initially identify by PAN, allow renaming later.
- **D-04: Post-Tax Priority:** Family aggregation focus on Post-Tax metrics.
- **D-05: Global Stats Update:** Dashboard stats grid to show Post-Tax Total Value and Post-Tax XIRR.
- **D-06: Symmetry:** Show Pre-Tax values for comparison, but Post-Tax is the primary target.

### the agent's Discretion
- Implementation details of "Managed Profiles" (table vs grouping).
- Exact UI layout for member grid (contract provides spacing/typography).

### Deferred Ideas (OUT OF SCOPE)
- **EPF & PPF Tracking:** Moved out of scope for Phase 10.
- **Manual Asset Engine (SGB/Gold):** Deferred to a subsequent v3.0 phase.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| REQ-10.1 | Auto-split CAS by PAN | `casparser` verified to extract PAN per folio. |
| REQ-10.2 | Managed Profile CRUD | Schema extension for `ManagedProfile` identified. |
| REQ-10.3 | Family Aggregated XIRR | `PerformanceService` can accept merged transactions. |
| REQ-10.4 | Post-Tax Dashboard | `TaxService` provides STCG/LTCG estimates for adjustment. |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| CAS PAN Detection | Backend (SyncService) | — | `casparser` returns PAN per folio; Backend must group them. |
| Managed Profile Creation | Backend (FamilyService) | — | Automatic creation of shadow profiles based on unique PANs. |
| Profile Renaming | Backend (API) | Frontend | User updates name; Backend persists it. |
| Family Aggregation | Backend (PerformanceService) | Frontend | Merging transactions and calculating XIRR must be done server-side. |
| Post-Tax Metrics | Backend (TaxService) | — | Tax estimation logic resides in the backend. |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `casparser` | 0.8.x | CAS PDF Parsing | Industry standard for Python-based CAS parsing; extracts PAN per folio. [VERIFIED: npm/pip] |
| `prisma` | 5.x | Database ORM | Existing project standard for type-safe schema management. |
| `PerformanceService` | Custom | XIRR Calculation | In-house Newton-Raphson implementation for returns. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|--------------|
| `TaxService` | Custom | Tax Estimation | Calculating STCG/LTCG for Post-Tax metrics. |

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `casparser` | PyPI | 4 yrs | 2k/mo | github.com/codereveal/casparser | [OK] | Approved |

## Architecture Patterns

### Recommended Project Structure
```
backend/
├── prisma/
│   └── schema.prisma        # Added ManagedProfile model
├── src/
│   ├── services/
│   │   ├── sync.service.ts   # Logic for multi-PAN splitting
│   │   ├── family.service.ts # Logic for Managed Profile management
│   │   └── performance.service.ts # Aggregate XIRR solver
│   └── routes/
│       └── portfolio.routes.ts # Updated /summary for aggregation
```

### Pattern 1: Multi-Portfolio Splitting
During CAS ingestion, instead of assigning all folios to a single `Portfolio`, the `SyncService` will:
1. Extract unique PANs.
2. Map each PAN to a `ManagedProfile` (creating if missing).
3. Create/Find a `Portfolio` linked to that `ManagedProfile`.
4. Group folios into these portfolios.

### Anti-Patterns to Avoid
- **Hard-coding "Self":** Avoid assuming the first PAN found is the user's PAN. All PANs should be treated as potentially manageable profiles.
- **Duplicate Folios:** Ensure joint folios appearing in multiple statements don't result in duplicate records. A folio is unique by `[number, assetId, portfolioId]`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| XIRR Calculation | Custom Solver | `PerformanceService.calculateXIRR` | Existing service handles complex cashflows and edge cases. |
| PDF Parsing | Custom Regex | `casparser` | CAS formats change; `casparser` is maintained and robust. |

## Common Pitfalls

### Pitfall 1: Missing PANs in CAS
**What goes wrong:** Older statements or certain RTAs might omit the PAN in the folio header.
**How to avoid:** Use a fallback profile named "Unknown/Other" or attribute to the primary user's portfolio.

### Pitfall 2: Joint Folios
**What goes wrong:** A folio with PAN A as primary and PAN B as secondary might appear in both A and B's CAS.
**How to avoid:** Deduplicate at the `Transaction` level using `externalId` (hash of content), and keep the folio linked to the first PAN that "claimed" it in a sync.

## Code Examples

### Schema Extension (Prisma)
```prisma
// Source: Proposed for Phase 10
model ManagedProfile {
  id          String      @id @default(uuid())
  name        String      // "Spouse", "Child", etc.
  pan         String
  userId      String
  user        User        @relation(fields: [userId], references: [id])
  portfolios  Portfolio[]
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt

  @@unique([userId, pan])
  @@index([userId])
}

model Portfolio {
  // ... existing fields
  managedProfileId String?
  managedProfile   ManagedProfile? @relation(fields: [managedProfileId], references: [id])
}
```

### Aggregated XIRR Logic
```typescript
// Conceptual implementation in Summary route
const allPortfolios = await prisma.portfolio.findMany({
  where: { userId },
  include: { folios: { include: { transactions: true } } }
});

const mergedCashflows = allPortfolios.flatMap(p => 
  p.folios.flatMap(f => f.transactions.map(tx => ({
    amount: tx.amount, // Signed correctly
    date: tx.date
  })))
);

const totalFamilyValue = allPortfolios.reduce((acc, p) => acc + p.currentValue, 0);
const familyXirr = PerformanceService.calculateXIRR(mergedCashflows, totalFamilyValue);
```

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `casparser` reliably extracts PAN for every folio in a consolidated statement. | Summary | Splitting might default to single portfolio if PAN is missing. |
| A2 | Users prefer auto-splitting by PAN over manual assignment. | Architecture | Might require UI for manual reassignment if auto-split is wrong. |

## Open Questions (RESOLVED)

1. **How to handle "Joint" portfolios? (RESOLVED)**
   - If a folio has two PANs, which profile does it belong to?
   - *Resolution:* Always attribute to the primary PAN as reported by the CAS. Joint folios appearing in multiple statements will be deduplicated at the transaction level via `externalId`. Primary PAN assignment is fixed upon first ingestion.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Python 3 | `casparser` | ✓ | 3.11+ | — |
| `casparser` | SyncService | ✓ | 0.8.5 | — |
| PostgreSQL | Data Layer | ✓ | 15.x | — |

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest |
| Quick run command | `npm test backend` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| REQ-10.1 | Detect multiple PANs and create separate portfolios | Integration | `jest backend/src/test/sync.split.test.ts` | ❌ Wave 0 |
| REQ-10.3 | Calculate correct family-level XIRR across merged cashflows | Unit | `jest backend/src/test/performance.aggregate.test.ts` | ❌ Wave 0 |

## Sources

### Primary (HIGH confidence)
- `casparser` Official Docs - PAN extraction behavior.
- `backend/prisma/schema.prisma` - Existing schema context.
- `backend/src/services/performance.service.ts` - XIRR solver implementation.

### Secondary (MEDIUM confidence)
- CAMS/KFintech CAS samples - Verification of multi-PAN structures in single PDF.

## Metadata
**Confidence breakdown:**
- Standard stack: HIGH - Libraries already in use.
- Architecture: HIGH - Clear path for schema extension.
- Pitfalls: MEDIUM - Joint folio handling needs careful implementation.

**Research date:** 2026-05-20
**Valid until:** 2026-06-20
