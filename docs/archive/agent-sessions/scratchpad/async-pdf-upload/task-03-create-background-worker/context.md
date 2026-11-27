# Context for Task: Create Background Worker

## Project Structure
This project is a monorepo containing a `backend` service (Node.js, Express, Prisma) and a `frontend` service (Vite, React). Docker Compose is used for orchestration.

## Task Overview
The task is to create a background worker process (`backend/src/worker.ts`) that consumes `processPdfUpload` jobs from the BullMQ queue. This worker will execute `ParserService.parseCAS`, `SyncService.syncPortfolio`, and `HistoryService.calculateHistory`. It will also handle temporary file cleanup.

**Crucial Note:** The task description mentions updating `prisma.uploadJob.update`. This refers to a Prisma model (`UploadJob`) that is technically scheduled to be implemented in Task 4. To avoid TypeScript compilation errors during Task 3's development, I will stub these database interactions with `TODO` comments.

## Relevant Files and Services
- `backend/src/worker.ts`: The new entry point to be created.
- `backend/src/jobs/queue.ts`: Contains `ProcessPdfUploadJobData` and connection details.
- `backend/src/services/parser.service.ts`: PDF parsing logic.
- `backend/src/services/sync.service.ts`: Portfolio syncing logic.
- `backend/src/services/history.service.ts`: History calculation logic.
- `backend/package.json`: Needs a new `worker` script.

## Implementation Details & Patterns

### Worker Structure (`backend/src/worker.ts`)
This file will:
1. Load environment variables.
2. Initialize a BullMQ `Worker` listening to the `pdfUploadQueue`.
3. Provide a processing function that:
    - Extracts `userId`, `filePath`, `password`, `jobId` from the job data.
    - Adds a `// TODO: Task 4 - Set status PROCESSING` comment.
    - Calls `ParserService.parseCAS`.
    - Calls `SyncService.syncPortfolio`.
    - Iterates over `syncResult.portfolioIds` and calls `HistoryService.calculateHistory` for each.
    - Adds a `// TODO: Task 4 - Set status COMPLETED` comment.
    - Has a `catch` block that adds a `// TODO: Task 4 - Set status FAILED` comment and rethrows or handles the error.
    - Has a `finally` block to execute `fs.unlinkSync(filePath)` to ensure cleanup.

### Package.json Update
Add a new script: `"worker": "ts-node-dev --respawn --transpile-only src/worker.ts"` (or similar depending on existing run scripts).
