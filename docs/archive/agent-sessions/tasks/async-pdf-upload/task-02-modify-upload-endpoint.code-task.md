# Task: Modify /upload Endpoint to Enqueue Job

## Description
Refactor the existing `POST /api/portfolio/upload` endpoint in `backend/src/routes/portfolio.routes.ts` to transform it into an asynchronous job initiator. Instead of directly processing the PDF, this endpoint will now save the file, create a job ID, enqueue the processing task into the job queue, and immediately return a `202 Accepted` response to the client.

## Background
This change is crucial for preventing `504 Gateway Time-out` errors for long-running PDF processing tasks. By offloading the heavy work, the API remains responsive, and users receive immediate feedback that their request has been accepted.

## Reference Documentation
**Required:**
- Design: (This task is part of a larger design for asynchronous processing, no single design doc yet)

**Additional References (if relevant to this task):**
- `backend/src/routes/portfolio.routes.ts`

**Note:** You MUST read the detailed design document before beginning implementation. Read additional references as needed for context.

## Technical Requirements
1.  Generate a unique identifier (`jobId`) for each upload job.
2.  Persist the uploaded file to a temporary location (current `multer` setup handles this).
3.  Enqueue a `processPdfUpload` job using the newly created job queue module. The job payload should include `userId`, `filePath`, `password`, and the generated `jobId`.
4.  Return a `202 Accepted` HTTP status code with a JSON response containing the `jobId` and a message indicating that processing has started.
5.  Remove the direct calls to `ParserService.parseCAS`, `SyncService.syncPortfolio`, and `HistoryService.calculateHistory` from this endpoint.
6.  Ensure error handling for file saving and job enqueueing is in place, returning appropriate `500` status codes if these initial steps fail.

## Dependencies
- Job Queue Module (Task 1: Implement Job Queue Module)
- Existing `multer` setup in `portfolio.routes.ts`.

## Implementation Approach
1. Import the job queue module into `portfolio.routes.ts`.
2. Inside the `router.post('/upload', ...)` handler:
    a. Generate a unique `jobId` (e.g., using `uuid` library).
    b. Construct the job payload.
    c. Call the `addProcessPdfJob` function from the job queue module.
    d. Modify the response to `res.status(202).json({ jobId, message: 'PDF upload accepted and processing has started.' });`
    e. Remove the synchronous calls to `ParserService.parseCAS`, `SyncService.syncPortfolio`, and `HistoryService.calculateHistory`.
    f. Update the `catch` block to handle errors related to job enqueueing.

## Acceptance Criteria

1. **Immediate Response**
   - Given a valid PDF file and password are sent to `/api/portfolio/upload`
   - When the request is received
   - Then the endpoint immediately responds with `202 Accepted` and a unique `jobId` in the response body.

2. **Job Enqueued**
   - Given a valid PDF upload request
   - When the endpoint processes the request
   - Then a `processPdfUpload` job is successfully enqueued in the job queue with the correct payload (userId, filePath, password, jobId).

3. **No Synchronous Processing**
   - Given the `/upload` endpoint receives a request
   - When the endpoint executes
   - Then `ParserService.parseCAS`, `SyncService.syncPortfolio`, and `HistoryService.calculateHistory` are NOT called directly within the endpoint's synchronous execution path.

4. **Error Handling**
   - Given an error occurs during file saving or job enqueueing
   - When the endpoint processes the request
   - Then an appropriate `500` error response is returned to the client.

## Metadata
- **Complexity**: Medium
- **Labels**: API, Async Processing, Job Queue, Backend
- **Required Skills**: Node.js, Express, TypeScript, Job Queue Integration, `uuid` library.