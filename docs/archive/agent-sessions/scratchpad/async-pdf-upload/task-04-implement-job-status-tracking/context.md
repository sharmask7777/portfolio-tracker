# Context for Task: Implement Job Status Tracking

## Project Structure
This project is a monorepo containing a `backend` service (Node.js, Express, Prisma) and a `frontend` service (Vite, React). Docker Compose is used for orchestration.

## Task Overview
The task is to implement the `UploadJob` Prisma model to track the status of background PDF processing jobs. This allows the backend and frontend to track job progress.

## Relevant Files and Services
- `backend/prisma/schema.prisma`: Where the new model is defined.

## Implementation Details
Added `UploadJob` model with fields `id`, `userId`, `filePath`, `status` (Enum: `UploadJobStatus`), `message`, and timestamps. Generated and applied Prisma migration `add_upload_job_model`.
