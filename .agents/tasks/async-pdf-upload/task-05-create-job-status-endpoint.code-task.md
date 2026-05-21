# Task: Create Job Status Endpoint

## Description
Implement a new GET API endpoint, `GET /api/portfolio/upload-status/:jobId`, that allows the frontend to query the current status and relevant metadata of a specific asynchronous PDF upload job. This endpoint will fetch the job's information from the `UploadJob` model in the database.

## Background
The frontend, after initiating an asynchronous upload, needs a mechanism to determine when the background processing is complete or if it has failed. This endpoint provides the necessary interface for polling the job's status, enabling a better user experience.

## Reference Documentation
**Required:**
- Design: (This task is part of a larger design for asynchronous processing, no single design doc yet)

**Additional References (if relevant to this task):**
- `backend/src/routes/portfolio.routes.ts`
- `backend/prisma/schema.prisma` (for `UploadJob` model)

**Note:** You MUST read the detailed design document before beginning implementation. Read additional references as needed for context.

## Technical Requirements
1. Add a new `GET` route to `backend/src/routes/portfolio.routes.ts` at `/upload-status/:jobId`.
2. The route handler should extract the `jobId` from the request parameters.
3. Use Prisma to query the `UploadJob` model for the job matching the `jobId`.
4. If the job is found, return its data (e.g., `id`, `status`, `message`, `completedAt`) with a `200 OK` status.
5. If the job is not found, return a `404 Not Found` status with an appropriate error message.
6. Implement error handling for database queries.

## Dependencies
- Database with `UploadJob` model (Task 4: Implement Job Status Tracking in Database)
- Prisma client.

## Implementation Approach
1. Open `backend/src/routes/portfolio.routes.ts`.
2. Add a new `router.get('/upload-status/:jobId', ...)` block.
3. Inside the handler:
    a. Extract `jobId` from `req.params`.
    b. Use `prisma.uploadJob.findUnique({ where: { id: jobId } })`.
    c. Based on the query result, send a `200 OK` or `404 Not Found` response.
    d. Implement a `try-catch` block for error handling.

## Acceptance Criteria

1. **Successful Status Retrieval**
   - Given a valid `jobId` exists in the database
   - When a GET request is made to `/api/portfolio/upload-status/:jobId`
   - Then the endpoint returns a `200 OK` status with the complete `UploadJob` record.

2. **Job Not Found**
   - Given an invalid or non-existent `jobId`
   - When a GET request is made to `/api/portfolio/upload-status/:jobId`
   - Then the endpoint returns a `404 Not Found` status with an appropriate error message.

3. **Error Handling**
   - Given a database error occurs during job retrieval
   - When the endpoint attempts to fetch the job status
   - Then a `500 Internal Server Error` is returned with an appropriate error message, and the error is logged.

4. **Authentication/Authorization (Implicit)**
   - Given the `authMiddleware` is applied to this route (as it is for other routes in `portfolio.routes.ts`)
   - When a user requests status for a job they did not initiate
   - Then the request is denied or an appropriate error is returned (assuming `userId` will be checked in the future for job ownership). *Self-correction: Initial implementation might not include job ownership check, but it's a good future consideration.*

## Metadata
- **Complexity**: Low
- **Labels**: API, Status, Backend, Database
- **Required Skills**: Node.js, Express, TypeScript, Prisma, REST API design.