# Testing Patterns

**Analysis Date:** 2024-05-17

## Test Framework

**Runner:**
- Jest (Backend)
- Config: `backend/jest.config.js`

**Assertion Library:**
- Jest (expect)

**Run Commands:**
```bash
npm test                # Run all tests in backend/
```

## Test File Organization

**Location:**
- Co-located with source code in `backend/src/services/`.

**Naming:**
- Unit tests: `*.spec.ts`
- Property-based tests: `*.pbt.spec.ts`

**Structure:**
```
backend/src/services/
├── [name].service.ts
└── [name].service.spec.ts
```

## Test Structure

**Suite Organization:**
```typescript
import { Service } from './service';
import { dep } from './dep';

jest.mock('./dep', () => ({ ... }));

describe('Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should perform expected action', async () => {
    // Arrange
    // Act
    // Assert
  });
});
```

**Patterns:**
- Setup pattern: `beforeEach` with `jest.clearAllMocks()`.
- Teardown pattern: Not explicitly observed (handled by Jest).
- Assertion pattern: `expect(...).toHaveBeenCalledWith(...)` and `expect(...).toBe(...)`.

## Mocking

**Framework:** Jest

**Patterns:**
```typescript
jest.mock('./db.service', () => ({
  prisma: {
    $transaction: jest.fn((cb) => cb(prisma)),
    familyGroup: {
      create: jest.fn(),
      // ...
    },
  },
}));
```

**What to Mock:**
- Database connections (`prisma`).
- External API calls.
- Heavy dependencies.

**What NOT to Mock:**
- Pure utility functions.
- Domain models/interfaces.

## Fixtures and Factories

**Test Data:**
```typescript
export class MockCASGenerator {
  public static generate(options = {}) {
    // Returns MockCAS object
  }
}
```

**Location:**
- `backend/test-utils/MockCASGenerator.ts`

## Coverage

**Requirements:** None enforced in `jest.config.js`.

**View Coverage:**
```bash
npm test -- --coverage
```

## Test Types

**Unit Tests:**
- Extensive coverage of backend services in `backend/src/services/`.
- Focused on business logic and database interactions (via mocks).

**Integration Tests:**
- Not explicitly separated from unit tests; many "unit" tests mock at the Prisma layer.

**Property-Based Testing (PBT):**
- Uses `fast-check` for robustness testing.
- Example: `backend/src/services/robustness.pbt.spec.ts`.
- Validates invariants in XIRR calculations and Tax FIFO logic.

**E2E Tests:**
- Not detected.

## Common Patterns

**Async Testing:**
```typescript
it('...', async () => {
  const result = await Service.method();
  expect(result).toBeDefined();
});
```

**Error Testing:**
```typescript
it('...', async () => {
  await expect(Service.method()).rejects.toThrow('Expected Error');
});
```

---

*Testing analysis: 2024-05-17*
