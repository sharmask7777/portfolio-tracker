# Codebase Concerns

**Analysis Date:** [YYYY-MM-DD]

## Tech Debt

**Monolithic Frontend Component:**
- Issue: `App.tsx` handles routing (via state), data fetching, parsing, state management, and layout logic.
- Files: `frontend/src/App.tsx`
- Impact: Hard to maintain, test, and scale. Adding new features will further bloat the file.
- Fix approach: Introduce a router (e.g., React Router), extract API calls into custom hooks or a service layer, and split layout components.

**Business Logic in Routes:**
- Issue: Complex DB transactions and business logic exist directly in the route handlers instead of isolated services.
- Files: `backend/src/routes/portfolio.routes.ts`
- Impact: Makes routes difficult to unit test and re-use logic across different endpoints.
- Fix approach: Extract logic from `/manual-asset` and `/summary` endpoints into a dedicated `PortfolioService`.

## Known Bugs

**Non-transactional Database Operations:**
- Symptoms: A failure during manual asset creation could leave orphan records (e.g., Asset created but Folio/Transaction failed).
- Files: `backend/src/routes/portfolio.routes.ts`
- Trigger: Database error or crash during the `/manual-asset` endpoint execution.
- Workaround: None currently. Needs manual DB cleanup.

## Security Considerations

**Unrestricted File Uploads:**
- Risk: `multer` is configured without file type filters or size limits. Attackers could upload large files leading to DoS, or non-PDF files that could crash the parser.
- Files: `backend/src/routes/portfolio.routes.ts`
- Current mitigation: None.
- Recommendations: Add `limits: { fileSize: ... }` and a `fileFilter` to `multer` configuration to restrict uploads to PDFs of reasonable size.

**Insecure Password Handling for CAS Parser:**
- Risk: The PDF password is passed as a command-line argument to the spawned Python process, making it visible to system monitoring tools (e.g., `ps aux`).
- Files: `backend/src/services/parser.service.ts`
- Current mitigation: None.
- Recommendations: Pass the password securely via standard input (stdin) or environment variables for the child process.

**Open CORS Configuration:**
- Risk: `cors()` is used without specific origins, allowing any domain to make requests to the backend.
- Files: `backend/src/index.ts`
- Current mitigation: None.
- Recommendations: Configure CORS to only allow requests from the specific frontend origin(s).

## Performance Bottlenecks

**Sequential API Fetches:**
- Problem: The daily NAV refresh job fetches data sequentially for all assets without batching or parallelism.
- Files: `backend/src/jobs/nav-refresh.job.ts`
- Cause: Uses a `for...of` loop with `await` on every external API call.
- Improvement path: Use `Promise.all` with a concurrency limit (e.g., using `p-limit` or batching) to speed up the process while respecting rate limits.

## Fragile Areas

**Hardcoded API Configurations:**
- Files: `frontend/src/App.tsx`, `backend/src/services/market-data.service.ts`
- Why fragile: Hardcoded `localhost` URLs in frontend and specific external APIs/exchange rates/fallback prices (e.g., `7500` for gold) in backend.
- Safe modification: Move all API URLs and configuration constants to `.env` files.
- Test coverage: Frontend has 0% coverage.

**Frontend Testing Gap:**
- Files: `frontend/src/App.tsx` and all `frontend/src/components/*`
- Why fragile: No testing framework is configured for the frontend. Any refactor risks regressions that won't be caught.
- Safe modification: Add Vite-compatible testing setup (Vitest + React Testing Library) and write core component tests.
- Test coverage: 0%

## Scaling Limits

**Sequential Scheduled Jobs:**
- Current capacity: Unknown, but scales linearly with number of unique assets.
- Limit: External API timeouts and long overall job duration as asset count grows.
- Scaling path: Implement batched background queues or worker pools instead of sequential in-process loops.

## Dependencies at Risk

**Mock Versions in package.json:**
- Risk: Dependencies like `@types/node` and others use modern/fake versions (`^25.8.0`), which may cause resolution issues if the real versions don't exist yet.
- Impact: Build or `npm install` failures for new developers.
- Migration plan: Align dependency versions with actual stable releases.

## Missing Critical Features

**Frontend Error Handling Boundaries:**
- Problem: Uncaught errors in components can crash the entire React application.
- Blocks: Prevents graceful degradation.

## Test Coverage Gaps

**Frontend Application:**
- What's not tested: Entire frontend UI and state logic.
- Files: `frontend/src/**/*.tsx`
- Risk: UI changes or backend API changes could silently break the frontend flow.
- Priority: High

---

*Concerns audit: [YYYY-MM-DD]*
