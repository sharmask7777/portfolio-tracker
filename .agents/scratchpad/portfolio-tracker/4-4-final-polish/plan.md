# Plan: Final UI/UX Polish & Performance Optimization

## Test Strategy
- **Visual Validation**: Manually check animations and theme transitions.
- **Performance Check**: 
    - Verify `npx prisma validate` after adding indexes.
    - Check frontend bundle size.
- **Responsiveness**: Verify dashboard layout on simulated mobile screens (375px width).

## Implementation Plan
1.  **Typography & Global Styles (`frontend/src/index.css`)**:
    - Update font-family to 'Inter' with better fallback.
    - Refine dark mode variables for better accessibility (contrast ratios).
    - Add global scrollbar styling.
2.  **Animations & Micro-interactions (`frontend/src/App.css`)**:
    - Add `@keyframes` for fade-in and slide-up.
    - Apply transitions to cards, buttons, and tab switches.
    - Refine hover states for all interactive elements.
3.  **Performance Optimization (Backend)**:
    - Update `schema.prisma` with `@@index` on `userId` in `Portfolio`, `portfolioId` in `Folio` and `Goal`, and `folioId` in `Transaction`.
    - Regenerate Prisma client.
4.  **UX & Error Handling (Frontend)**:
    - Add a "Toast" or improved notification for upload success/failure.
    - Create a reusable `EmptyState` component for analytical views.
5.  **Mobile Audit**:
    - Refine `stats-grid` and `xray-grid` to stack correctly on small screens.
    - Ensure tables have horizontal scroll if overflowed.
