# Plan: Project Skeleton & Environment Setup

## Test Strategy
- **Infrastructure Test**: Run `docker-compose config` to validate the file.
- **Backend Test**:
    - Verify `backend/package.json` existence.
    - Verify `npm run build` succeeds.
    - Verify health endpoint `/health` returns `200 OK`.
- **Frontend Test**:
    - Verify `frontend/package.json` existence.
    - Verify `npm run build` succeeds.
- **Linting Test**: Run `eslint .` and verify no errors.

## Implementation Plan
1.  **Git Initialization**: `git init` (if not already initialized).
2.  **Backend Setup**:
    - Initialize `npm init -y` in `backend/`.
    - Install dependencies: `express`, `cors`, `helmet`, `morgan`, `dotenv`.
    - Install dev dependencies: `typescript`, `@types/node`, `@types/express`, `@types/cors`, `@types/morgan`, `ts-node-dev`, `rimraf`.
    - Configure `tsconfig.json`.
    - Create basic `src/index.ts` with health-check.
3.  **Frontend Setup**:
    - Use Vite to scaffold React + TypeScript in `frontend/`.
    - Clean up default Vite boilerplate.
4.  **Tooling Configuration**:
    - Install `eslint`, `prettier`, `eslint-config-prettier`, `eslint-plugin-prettier` at root.
    - Configure `.eslintrc.json` and `.prettierrc`.
5.  **Infrastructure Configuration**:
    - Create `docker-compose.yml` with `postgres` and `redis`.
    - Create `.env.example` files.
6.  **Root package.json**:
    - Set up scripts to run both frontend and backend concurrently (using `concurrently`).
