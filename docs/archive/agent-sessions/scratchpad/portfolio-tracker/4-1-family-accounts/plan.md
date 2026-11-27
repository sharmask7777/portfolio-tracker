# Plan: Family Accounts (Multi-PAN Consolidation)

## Test Strategy
- **Unit Tests**:
    - Test `FamilyService` for creating groups and adding members.
    - Test `getAggregatedSummary` for correct math across multiple portfolios.
    - Verify that tax calculations in aggregated views still point to individual PANs/Folios.
- **API Tests**:
    - `GET /api/portfolio/summary?familyGroupId=...`: Verify it returns combined data.
- **Frontend Check**:
    - Verify "Family Net Worth" toggle updates the dashboard numbers.

## Implementation Plan
1.  **Database Schema Update (`backend/prisma/schema.prisma`)**:
    - Add `FamilyGroup` model (id, name, ownerId).
    - Add `FamilyMember` join table (userId, groupId, role).
    - Update `Portfolio` to potentially link to a `FamilyGroup` or keep it simple with sharing logic.
2.  **Family Service (`backend/src/services/family.service.ts`)**:
    - Implement methods to create a group, invite members (mocked or simple), and list members.
    - Implement `getFamilyPortfolios(groupId)` to fetch all associated data.
3.  **API Integration**:
    - Add `backend/src/routes/family.routes.ts`.
    - Update `portfolio.routes.ts` summary endpoint to handle aggregation if `familyGroupId` is provided.
4.  **Aggregation Logic**:
    - Loop through all folios of all family members.
    - Sum up `totalValue`, `totalInvested`, and `totalGain`.
    - Aggregate `enrichedFolios` for the holdings table.
5.  **Frontend Updates**:
    - Create a simple "Family Management" component.
    - Add a toggle in `App.tsx` for "Individual vs Family" view.
    - Fetch aggregated data when toggle is set to "Family".
