# Plan for Task: Create Background Worker

## Test Strategy

This task will be verified using unit tests in `backend/src/test/worker.test.ts`. The tests will isolate the worker logic by mocking BullMQ, the filesystem, and the involved services.

### Test Scenarios for `backend/src/worker.ts`

#### 1. Successful Processing Workflow

-   **Given:** A mocked `processPdfUpload` job with valid data.
-   **And:** `ParserService`, `SyncService`, and `HistoryService` are mocked to succeed.
-   **When:** The worker's processing function is called with the job.
-   **Then:** `ParserService.parseCAS` is called with the correct file path and password.
-   **And:** `SyncService.syncPortfolio` is called with the user ID and parsed data.
-   **And:** `HistoryService.calculateHistory` is called for each returned portfolio ID.
-   **And:** `fs.unlinkSync` is called with the file path (cleanup).

#### 2. Processing Failure - Parser Error

-   **Given:** A mocked `processPdfUpload` job.
-   **And:** `ParserService.parseCAS` is mocked to throw an error.
-   **When:** The worker's processing function is called.
-   **Then:** The function throws the error (or rejects the promise).
-   **And:** `SyncService` and `HistoryService` are *not* called.
-   **And:** `fs.unlinkSync` is still called with the file path (cleanup must happen on failure).

#### 3. Processing Failure - Sync Error

-   **Given:** A mocked `processPdfUpload` job.
-   **And:** `ParserService.parseCAS` succeeds.
-   **And:** `SyncService.syncPortfolio` is mocked to throw an error.
-   **When:** The worker's processing function is called.
-   **Then:** The function throws the error.
-   **And:** `HistoryService` is *not* called.
-   **And:** `fs.unlinkSync` is called.

## Implementation Planning

The implementation will involve:

1.  **Creating `backend/src/worker.ts`**:
    *   Set up BullMQ Worker.
    *   Implement the core processing logic with `try...catch...finally`.
    *   Add TODOs for Prisma status updates (Task 4).
2.  **Modifying `backend/package.json`**:
    *   Add `"worker"` script.
