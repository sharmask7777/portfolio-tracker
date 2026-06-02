# Coding Conventions

**Analysis Date:** 2024-05-17

## Naming Patterns

**Files:**
- Services: `[name].service.ts` e.g., `backend/src/services/family.service.ts`
- Components: `[Name].tsx` e.g., `frontend/src/components/Analytics/XRayView.tsx`
- Tests: `[name].spec.ts` or `[name].pbt.spec.ts` e.g., `backend/src/services/family.service.spec.ts`
- Styles: `[Name].css` or `index.css`

**Functions:**
- camelCase for all functions and methods.
- static methods in services: `public static async createFamilyGroup`

**Variables:**
- camelCase for local variables and state.
- PascalCase for React components and Classes.
- UPPER_SNAKE_CASE for constants.

**Types:**
- PascalCase for Interfaces and Types.
- Prefixed with `I` is not observed; standard PascalCase preferred.

## Code Style

**Formatting:**
- Prettier is used.
- Settings: semi-colons, single quotes, 2-space indentation, 100 char print width.
- `.prettierrc` configuration file present in root.

**Linting:**
- ESLint with `typescript-eslint`.
- Backend uses `backend/eslint.config.mjs`.
- Frontend uses `frontend/eslint.config.js` with React-specific plugins.

## Import Organization

**Order:**
1. React and third-party libraries (`react`, `axios`, `lucide-react`, `recharts`)
2. Internal components and services
3. Styles and assets

**Path Aliases:**
- Relative paths are primarily used (e.g., `import { prisma } from './db.service'`).

## Error Handling

**Patterns:**
- Try/catch blocks in high-level operations (controllers, frontend handlers).
- Explicit `throw new Error('...')` in services for business logic failures.
- Prisma transaction usage for multi-step operations in `backend/src/services/family.service.ts`.

## Logging

**Framework:** console

**Patterns:**
- `console.error` for caught exceptions.
- `console.log` for development debugging (minimal).

## Comments

**When to Comment:**
- JSDoc used for documenting service methods and class responsibilities.
- Inline comments for complex logic (e.g., flattening portfolios in `FamilyService`).

**JSDoc/TSDoc:**
- Observed on service methods: `/** ... */`

## Function Design

**Size:** Generally focused on single responsibilities.

**Parameters:** Named parameters or small number of positional parameters.

**Return Values:** Promises for async operations, typically returning the created/fetched object.

## Module Design

**Exports:**
- Named exports for services and utility functions.
- Default exports for React components.

**Barrel Files:**
- Not extensively used; direct imports preferred.

---

*Convention analysis: 2024-05-17*
