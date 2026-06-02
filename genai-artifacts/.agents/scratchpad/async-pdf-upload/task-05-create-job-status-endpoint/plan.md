# Plan for Task: Create Job Status Endpoint

## Test Strategy

This task will be verified using integration tests in `backend/src/test/routes/portfolio.routes.test.ts`.

### Test Scenarios for `GET /api/portfolio/upload-status/:jobId`

#### 1. Successful Retrieval
-   **Given:** A valid `jobId` that exists in the database and belongs to the authenticated user.
-   **And:** Prisma `findUnique` is mocked to return the job data.
-   **When:** A `GET` request is made to `/api/portfolio/upload-status/:jobId`.
-   **Then:** The endpoint returns `200 OK`.
-   **And:** The response body matches the mocked job data.

#### 2. Job Not Found
-   **Given:** A `jobId` that does not exist in the database.
-   **And:** Prisma `findUnique` is mocked to return `null`.
-   **When:** A `GET` request is made.
-   **Then:** The endpoint returns `404 Not Found`.

#### 3. Unauthorized Access (Job belongs to another user)
-   **Given:** A valid `jobId` that exists but belongs to a different `userId` than the authenticated user.
-   **And:** Prisma `findUnique` is mocked to return the job data with a different `userId`.
-   **When:** A `GET` request is made.
-   **Then:** The endpoint returns `404 Not Found` (returning 404 instead of 403 prevents leaking the existence of the job ID to unauthorized users).

#### 4. Database Error
-   **Given:** A database error occurs during query.
-   **And:** Prisma `findUnique` is mocked to throw an error.
-   **When:** A `GET` request is made.
-   **Then:** The endpoint returns `500 Internal Server Error`.

## Implementation Planning

1.  **Modify `backend/src/test/routes/portfolio.routes.test.ts`**:
    *   Add a new `describe` block for the `GET /upload-status/:jobId` endpoint.
    *   Implement the four test scenarios defined above.
    *   Mock `prisma.uploadJob.findUnique`.
2.  **Modify `backend/src/routes/portfolio.routes.ts`**:
    *   Add the new route handler using `router.get('/upload-status/:jobId', async (req, res) => { ... })`.
    *   Implement the logic to extract `jobId`, query Prisma, check authorization, and send the appropriate response.
