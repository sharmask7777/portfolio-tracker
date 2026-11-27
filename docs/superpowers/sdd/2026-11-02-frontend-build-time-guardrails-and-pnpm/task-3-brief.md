# Task 3 Brief: ESLint Architectural Boundaries, File Conventions & React Hooks

## Task Objective
Install and configure `eslint-plugin-boundaries` and `eslint-plugin-check-file` in `frontend/eslint.config.js`, enforce unidirectional architecture across `components`, `utils`, `types`, and `contexts`, enforce component file naming (PascalCase) and utility file naming (kebab-case), and elevate React Hooks rules (`rules-of-hooks`, `exhaustive-deps`) to `"error"`.

## Plan Excerpt
- Modify: `frontend/package.json`
- Modify: `frontend/eslint.config.js`

## Steps
1. Install plugins as devDependencies in `frontend`:
   `pnpm --filter frontend add -D eslint-plugin-boundaries eslint-plugin-check-file`
2. Update `frontend/eslint.config.js`:
   - Import `boundaries` from `'eslint-plugin-boundaries'` and `checkFile` from `'eslint-plugin-check-file'`.
   - Add boundary element types and rules:
     - Element types by pattern:
       - `components` -> `src/components/**/*`
       - `utils` -> `src/utils/**/*`
       - `types` -> `src/types/**/*`
       - `contexts` -> `src/contexts/**/*`
     - Component subdomains: `Analytics`, `Tax`, `Dashboard`, `Family`, `Auth`, `Insights`.
     - Rules:
       - `boundaries/element-types`:
         - Disallow `utils` from importing `components`.
         - Disallow `types` from importing `components`, `utils`, or `contexts`.
         - Disallow circular dependencies between element types.
         - Disallow cross-subdomain private imports between component subdomains (e.g. `Tax` components cannot import internal components of `Analytics`).
   - Add file naming rules with `eslint-plugin-check-file`:
     - `src/components/**/*.{tsx}`: `PASCAL_CASE` (with ignore pattern for `index.tsx`, `index.ts`, `*.test.tsx`).
     - `src/utils/**/*.{ts}`: `KEBAB_CASE` (with ignore pattern for `*.test.ts`).
   - Set React Hooks rules to `"error"`:
     - `'react-hooks/rules-of-hooks': 'error'`
     - `'react-hooks/exhaustive-deps': 'error'`
3. Run `pnpm --filter frontend lint` to test.
   - If any files violate naming or boundary rules, remediate them cleanly.
4. Verify:
   - `pnpm --filter frontend lint` passes with 0 errors and 0 warnings.
   - `pnpm --filter frontend typecheck` passes with 0 errors.
   - `pnpm --filter frontend test:unit` passes with 100% tests and meets coverage gates.
5. Commit:
   `git add frontend/package.json frontend/eslint.config.js pnpm-lock.yaml` (plus any remediated files)
   `git commit -m "feat(lint): enforce architectural boundaries, file naming, and strict react hooks rules"`
6. Write report to `/Users/shaleensharma/workplace/gemini_ws/portfolio-tracker/.superpowers/sdd/2026-11-02-frontend-build-time-guardrails-and-pnpm/task-3-report.md`.
7. Return a short message with your commit hash and summary of changed files. Do NOT dispatch any subagents.

## Constraints & Mandates
- Follow `AGENTS.md`: The Zero-Any Mandate; The Invariant Oracle Law; Universal Generality Mandate.
- Working directory: `/Users/shaleensharma/workplace/gemini_ws/portfolio-tracker`.
