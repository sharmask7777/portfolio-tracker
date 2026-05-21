# Plan for Task: Modify /upload Endpoint

## Test Strategy

This task will involve integration tests using `supertest` to verify the behavior of the `POST /api/portfolio/upload` endpoint. External dependencies like the job queue, parser service, sync service, and history service will be mocked to isolate the endpoint's logic.

### Test Scenarios for `backend/src/routes/portfolio.routes.ts` (`POST /upload`)

#### 1. Successful Upload - Immediate Response and Job Enqueued

-   **Given:** A valid PDF file is included in the request payload.
-   **And:** The `addProcessPdfJob` function from the job queue module is mocked to resolve successfully.
-   **When:** A `POST` request is sent to `/api/portfolio/upload` with authentication, the PDF file, and a password.
-   **Then:** The HTTP response status code is `202 Accepted`.
-   **And:** The response body contains a `jobId` (string) and a message indicating that processing has started.
-   **And:** The `addProcessPdfJob` function is called exactly once with `userId`, `filePath` (from `req.file.path`), `password` (from `req.body`), and the generated `jobId`.
-   **And:** `ParserService.parseCAS`, `SyncService.syncPortfolio`, and `HistoryService.calculateHistory` are *not* called during the request handling.
-   **And:** The temporary file created by `multer` is unlinked/deleted after job enqueueing.

#### 2. Missing File - Bad Request

-   **Given:** No file is provided in the request payload.
-   **When:** A `POST` request is sent to `/api/portfolio/upload` with authentication but without a file.
-   **Then:** The HTTP response status code is `400 Bad Request`.
-   **And:** The response body contains an error message such as 'No file uploaded'.
-   **And:** The `addProcessPdfJob` function is *not* called.

#### 3. Job Enqueueing Failure - Internal Server Error

-   **Given:** A valid PDF file is included in the request payload.
-   **And:** The `addProcessPdfJob` function is mocked to throw an error (e.g., due to Redis being down or an issue with the job queue module).
-   **When:** A `POST` request is sent to `/api/portfolio/upload` with authentication, the PDF file, and a password.
-   **Then:** The HTTP response status code is `500 Internal Server Error`.
-   **And:** The response body contains an error message reflecting the job enqueueing failure.
-   **And:** The temporary file created by `multer` is unlinked/deleted.

## Implementation Planning

The implementation will involve:

1.  **Install `uuid` and `@types/uuid` dependencies**: Add to `backend/package.json` and run `npm install`.
2.  **Modify `backend/src/routes/portfolio.routes.ts`**:
    *   Import `v4 as uuidv4` from `uuid`.
    *   Import `addProcessPdfJob` and `ProcessPdfUploadJobData` from `../jobs/queue`.
    *   Inside the `router.post('/upload', ...)` handler:
        *   Generate `jobId` using `uuidv4()`.
        *   Replace synchronous calls with an `await addProcessPdfJob(...)` call.
        *   Update the response to `res.status(202).json({ jobId, message: '...' });`.
        *   Adjust the `catch` block to handle errors from `addProcessPdfJob` and ensure file cleanup.
3.  **Cleanup temporary file**: Ensure `fs.unlinkSync(filePath)` is called in both success and error paths.
