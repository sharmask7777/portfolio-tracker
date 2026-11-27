# Task 1 Brief: pnpm Workspace Migration & Docker/CI Alignment

## Task Objective
Migrate the workspace package management from `npm` to `pnpm` using a unified monorepo workspace configuration, generating a single `pnpm-lock.yaml` at the repository root, updating `package.json` scripts across root and `frontend/`, adjusting `docker-compose.yml` and `frontend/Dockerfile` to build cleanly from root context, and updating `.husky/pre-push` and `.github/workflows/e2e.yml`.

## Plan Excerpt
- Create: `pnpm-workspace.yaml`
- Modify: `package.json`
- Modify: `frontend/package.json`
- Modify: `docker-compose.yml`
- Modify: `frontend/Dockerfile`
- Create/Modify: `.dockerignore`
- Modify: `.husky/pre-push`
- Modify: `.github/workflows/e2e.yml`
- Delete: `package-lock.json`, `frontend/package-lock.json`

## Steps
1. Create `pnpm-workspace.yaml` at repo root:
   ```yaml
   packages:
     - 'frontend'
   ```
2. Generate root `pnpm-lock.yaml`:
   - Run `pnpm install` at root.
   - Remove `package-lock.json` and `frontend/package-lock.json` (`git rm package-lock.json frontend/package-lock.json`).
3. Update scripts in root `package.json`:
   - Replace `npm run ... --prefix frontend` with `pnpm --filter frontend ...`.
   - Update `dev`, `build`, `lint`, `test`, `test:coverage:frontend`.
4. Update `frontend/package.json`:
   - Ensure dev, build, lint, and test scripts use `pnpm` idioms if needed.
5. Update `docker-compose.yml`, `frontend/Dockerfile`, and `.dockerignore`:
   - In `docker-compose.yml`, change `frontend.build`:
     ```yaml
     frontend:
       build:
         context: .
         dockerfile: frontend/Dockerfile
     ```
   - In `frontend/Dockerfile`:
     - Update installation steps: install pnpm (`RUN corepack enable || npm install -g pnpm@12`).
     - Copy `pnpm-lock.yaml`, `pnpm-workspace.yaml`, and `frontend/package.json`.
     - Run `pnpm install --frozen-lockfile --filter frontend...`.
     - Copy `frontend/` source and build with `pnpm --filter frontend build`.
   - In `.dockerignore` (at root): ensure `backend-rs/target`, `.git`, `node_modules` are ignored.
6. Update `.husky/pre-push`:
   - Replace `npm run ...` with `pnpm ...` (e.g. `pnpm --filter frontend test:unit`, `pnpm --filter frontend build`, `pnpm --filter frontend test:e2e:docker`).
7. Update `.github/workflows/e2e.yml`:
   - Replace `npm ci` with:
     ```yaml
     - uses: pnpm/action-setup@v4
       with:
         version: 12
     - uses: actions/setup-node@v4
       with:
         node-version: lts/*
         cache: 'pnpm'
     - name: Install dependencies
       run: pnpm install --frozen-lockfile
     ```
   - Update hermetic test and build steps to use `pnpm`.
8. Verify:
   - `pnpm install --frozen-lockfile` runs cleanly with 0 errors.
   - `pnpm --filter frontend build` builds cleanly.
   - `pnpm --filter frontend test:unit` passes.
9. Commit:
   `git commit -m "feat(infra): migrate workspace from npm to pnpm with unified lockfile and docker context"`

## Constraints & Mandates
- Follow `AGENTS.md`: The Zero-Any Mandate; Universal Generality Mandate.
- Never delete `frontend/src/types/generated/**`.
- Working directory: `/Users/shaleensharma/workplace/gemini_ws/portfolio-tracker`.
