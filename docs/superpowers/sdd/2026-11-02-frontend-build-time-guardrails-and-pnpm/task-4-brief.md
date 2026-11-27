# Task 4 Brief: Schema-Validated Environment Variables (`@t3-oss/env-core` & `zod`)

## Task Objective
Install `@t3-oss/env-core` and `zod` in `frontend/`, create `frontend/src/env.ts` defining a typed, validated schema for client-side environment variables, add unit test `frontend/src/env.test.ts`, and refactor `frontend/src/api.ts` and `frontend/src/config.ts` to consume the validated `env` object instead of accessing `import.meta.env` directly.

## Plan Excerpt
- Modify: `frontend/package.json`
- Create: `frontend/src/env.ts`
- Create: `frontend/src/env.test.ts`
- Modify: `frontend/src/api.ts`
- Modify: `frontend/src/config.ts`

## Steps
1. Install `@t3-oss/env-core` and `zod` in `frontend`:
   `pnpm --filter frontend add @t3-oss/env-core zod`
2. Create unit test `frontend/src/env.test.ts`:
   ```typescript
   import { describe, it, expect } from 'vitest';
   import { env } from './env';

   describe('env configuration', () => {
     it('provides validated env object', () => {
       expect(env).toBeDefined();
       expect(typeof env.VITE_API_URL === 'string' || env.VITE_API_URL === undefined).toBe(true);
     });
   });
   ```
3. Create `frontend/src/env.ts`:
   ```typescript
   import { createEnv } from '@t3-oss/env-core';
   import { z } from 'zod';

   export const env = createEnv({
     clientPrefix: 'VITE_',
     client: {
       // Allows empty string, relative URLs (for production Nginx proxying), or absolute URLs
       VITE_API_URL: z.string().optional(),
     },
     shared: {
       MODE: z.string().optional(),
       DEV: z.boolean().optional(),
       PROD: z.boolean().optional(),
     },
     runtimeEnv: import.meta.env,
     emptyStringAsUndefined: true,
   });
   ```
4. Refactor `frontend/src/api.ts` and `frontend/src/config.ts`:
   - Replace raw `import.meta.env.VITE_API_URL` with `env.VITE_API_URL`.
   - Replace raw `import.meta.env.PROD` with `env.PROD`.
5. Run lint, typecheck, and tests:
   - `pnpm --filter frontend lint`
   - `pnpm --filter frontend typecheck`
   - `pnpm --filter frontend test:unit`
6. Commit:
   `git add frontend/package.json frontend/src/env.ts frontend/src/env.test.ts frontend/src/api.ts frontend/src/config.ts pnpm-lock.yaml`
   `git commit -m "feat(env): introduce schema-validated environment variables via @t3-oss/env-core and zod"`
7. Write report to `/Users/shaleensharma/workplace/gemini_ws/portfolio-tracker/.superpowers/sdd/2026-11-02-frontend-build-time-guardrails-and-pnpm/task-4-report.md`.
8. Return short summary with commit hash. Do NOT dispatch any subagents.

## Constraints & Mandates
- Follow `AGENTS.md`: The Zero-Any Mandate; The Invariant Oracle Law; Universal Generality Mandate.
- Working directory: `/Users/shaleensharma/workplace/gemini_ws/portfolio-tracker`.
