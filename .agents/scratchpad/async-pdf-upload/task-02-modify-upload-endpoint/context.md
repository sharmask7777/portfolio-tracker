# Context for Task: Modify /upload Endpoint

## Project Structure
This project is a monorepo containing a `backend` service (Node.js, Express, Prisma) and a `frontend` service (Vite, React). Docker Compose is used for orchestration.

## Task Overview
The task is to refactor the existing `POST /api/portfolio/upload` endpoint in `backend/src/routes/portfolio.routes.ts`. Instead of synchronous PDF processing, it will now save the file, generate a job ID, enqueue the processing task into the job queue, and immediately return a `202 Accepted` response to the client with the `jobId`. This prevents `504 Gateway Time-out` errors for long-running PDF processing tasks.

## Relevant Files and Services
- `backend/src/routes/portfolio.routes.ts`: The target file for modification.
- `backend/src/jobs/queue.ts`: The job queue module implemented in Task 1, providing `addProcessPdfJob`.
- `backend/package.json`: For `uuid` library dependency.
- `uploads/` directory: Where `multer` temporarily stores uploaded files.

## Discovered Documentation
- `./GEMINI_README.md`: General project README.
- `./frontend/README.md`: Frontend-specific README.
- `./README.md`: Main project README.
- `./skills/README.md`: Documentation for skills.
- `./.planning/codebase/ARCHITECTURE.md`: High-level architectural overview.
- `./.planning/codebase/TESTING.md`: Information regarding project testing.

## Task Details (from task-02-modify-upload-endpoint.code-task.md)
**Description:** Refactor the existing `POST /api/portfolio/upload` endpoint in `backend/src/routes/portfolio.routes.ts` to transform it into an asynchronous job initiator. Instead of directly processing the PDF, this endpoint will now save the file, create a job ID, enqueue the processing task into the job queue, and immediately return a `202 Accepted` response to the client.
**Technical Requirements:**
1.  Generate a unique identifier (`jobId`) for each upload job.
2.  Persist the uploaded file to a temporary location (current `multer` setup handles this).
3.  Enqueue a `processPdfUpload` job using the newly created job queue module. The job payload should include `userId`, `filePath`, `password`, and the generated `jobId`.
4.  Return a `202 Accepted` HTTP status code with a JSON response containing the `jobId` and a message indicating that processing has started.
5.  Remove the direct calls to `ParserService.parseCAS`, `SyncService.syncPortfolio`, and `HistoryService.calculateHistory` from this endpoint.
6.  Ensure error handling for file saving and job enqueueing is in place, returning appropriate `500` status codes if these initial steps fail.

## Implementation Details & Patterns

### Dependencies to Add
- `uuid`: Will be added to `backend/package.json` for generating `jobId`.
- `@types/uuid`: Will be added to `backend/package.json` (devDependencies) for TypeScript support.

### Module Structure (`backend/src/routes/portfolio.routes.ts`)
The `POST /upload` route handler will be modified to:
1.  Import `v4 as uuidv4` from `uuid`.
2.  Import `addProcessPdfJob` and `ProcessPdfUploadJobData` from `backend/src/jobs/queue.ts`.
3.  Generate `jobId` using `uuidv4()`.
4.  Call `addProcessPdfJob({ userId, filePath, password, jobId })`.
5.  Respond with `res.status(202).json({ jobId, message: 'PDF upload accepted and processing has started.' });`.
6.  Remove existing synchronous calls to `ParserService.parseCAS`, `SyncService.syncPortfolio`, and `HistoryService.calculateHistory`.
7.  Ensure the `catch` block correctly handles errors from file saving or job enqueueing, returning a `500` status.
