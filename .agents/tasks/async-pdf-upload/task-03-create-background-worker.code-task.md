# Task: Create Background Worker for PDF Processing

## Description
Implement a separate worker process that will consume jobs from the job queue. This worker will be responsible for executing the heavy-lifting operations of PDF parsing, portfolio syncing, and history calculation, which were previously performed synchronously by the `/upload` endpoint. The worker must also update the job status in the database at various stages (e.g., PENDING, PROCESSING, COMPLETED, FAILED).

## Background
This worker is the core component of the asynchronous processing system. It ensures that the main API remains responsive while complex and potentially long-running tasks are handled reliably in the background, preventing client-side timeouts.

## Reference Documentation
**Required:**
- Design: (This task is part of a larger design for asynchronous processing, no single design doc yet)

**Additional References (if relevant to this task):**
- `backend/src/services/parser.service.ts`
- `backend/src/services/sync.service.ts`
- `backend/src/services/history.service.ts`
- `backend/src/jobs/` (Job Queue Module)

**Note:** You MUST read the detailed design document before beginning implementation. Read additional references as needed for context.

## Technical Requirements
1. Create a new entry point for the worker process (e.g., a new script `backend/src/worker.ts`).
2. Initialize the job queue listener within the worker process to subscribe to `processPdfUpload` jobs.
3. Implement the job handler function that:
    a. Retrieves job data (userId, filePath, password, jobId).
    b. Updates the job status to 'PROCESSING' in the database at the start.
    c. Calls `ParserService.parseCAS`, `SyncService.syncPortfolio`, and `HistoryService.calculateHistory`.
    d. Updates the job status to 'COMPLETED' upon successful execution.
    e. Catches errors during processing, updates the job status to 'FAILED' with an error message, and logs the error.
    f. Cleans up temporary files (`filePath`) after processing (success or failure).
4. Ensure the worker can be started independently (e.g., via `npm run worker` or a Docker Compose service entry).

## Dependencies
- Job Queue Module (Task 1: Implement Job Queue Module)
- `ParserService`, `SyncService`, `HistoryService`
- Database for job status tracking (Task 4: Implement Job Status Tracking in Database)

## Implementation Approach
1. Create `backend/src/worker.ts`.
2. In `worker.ts`, import the job queue setup and the necessary services.
3. Define the job processor function for `processPdfUpload` jobs.
4. Inside the processor function, implement the logic:
    a. Use `prisma.uploadJob.update` to set status to `PROCESSING`.
    b. Execute the parsing, syncing, and history calculation logic.
    c. Use `prisma.uploadJob.update` to set status to `COMPLETED` or `FAILED`.
    d. Implement `fs.unlinkSync(filePath)` for cleanup.
5. Add a new `script` entry in `backend/package.json` to start the worker.
6. Consider adding a new service to `docker-compose.yml` for the worker.

## Acceptance Criteria

1. **Worker Startup**
   - Given the worker script is executed
   - When the worker initializes
   - Then it successfully connects to the job queue and starts listening for jobs.

2. **Job Consumption**
   - Given a `processPdfUpload` job is enqueued
   - When the worker is running
   - Then the worker picks up the job from the queue.

3. **Full Processing Workflow**
   - Given a `processPdfUpload` job with valid data
   - When the worker processes the job
   - Then `ParserService.parseCAS`, `SyncService.syncPortfolio`, and `HistoryService.calculateHistory` are executed sequentially with the provided data.

4. **Status Updates on Success**
   - Given a job completes successfully
   - When the worker finishes processing
   - Then the job's status in the database is updated to 'COMPLETED'.

5. **Status Updates on Failure**
   - Given a job encounters an error during processing
   - When the worker catches the error
   - Then the job's status in the database is updated to 'FAILED' with an associated error message.

6. **File Cleanup**
   - Given a temporary uploaded file path
   - When the worker finishes processing (success or failure)
   - Then the temporary file is deleted from the filesystem.

## Metadata
- **Complexity**: High
- **Labels**: Worker, Background Processing, Job Queue, Backend, Services
- **Required Skills**: Node.js, TypeScript, Job Queue Libraries, Prisma, Express, Error Handling, File System Operations.