# Context for Task: Create Job Status Endpoint

## Project Structure
This project is a monorepo containing a `backend` service (Node.js, Express, Prisma) and a `frontend` service (Vite, React). Docker Compose is used for orchestration.

## Task Overview
The task is to implement a new API endpoint `GET /api/portfolio/upload-status/:jobId` in `backend/src/routes/portfolio.routes.ts`. This endpoint will query the database (via Prisma) to retrieve the status of an asynchronous PDF upload job using the `UploadJob` model created in Task 4.

## Relevant Files and Services
- `backend/src/routes/portfolio.routes.ts`: The file where the new endpoint will be added.
- `backend/prisma/schema.prisma`: Defines the `UploadJob` model.
- `backend/src/services/db.service.ts`: Provides the configured Prisma client.

## Task Details (from task-05-create-job-status-endpoint.code-task.md)
**Description:** Implement `GET /api/portfolio/upload-status/:jobId` to query the current status and metadata of a specific asynchronous PDF upload job.
**Technical Requirements:**
1. Extract `jobId` from request parameters.
2. Query `UploadJob` using `prisma.uploadJob.findUnique`.
3. Ensure the job belongs to the requesting user (`userId` matches `req.user.id`). Although not explicitly mandated as a strict requirement in the description, the "Self-correction" note highlights it as a good consideration, and it's essential for security. I will implement this authorization check.
4. Return `200 OK` with job data if found.
5. Return `404 Not Found` if the job doesn't exist or belongs to another user.
6. Handle database errors and return `500 Internal Server Error`.
