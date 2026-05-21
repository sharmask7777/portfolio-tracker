# Context for Implementing Job Queue Module

## Project Structure
This project is a monorepo containing a `backend` service (Node.js, Express, Prisma) and a `frontend` service (Vite, React). Docker Compose is used for orchestration.

## Task Overview
The current task is to implement a job queue module for asynchronous processing of PDF uploads. This is part of a larger effort to address 504 Gateway Time-out errors by offloading long-running tasks from the main API thread to background workers, improving responsiveness and user experience.

## Relevant Files and Services
- `backend/src/routes/portfolio.routes.ts`: Contains the current synchronous PDF upload endpoint.
- `docker-compose.yml`: Defines the project's services, including `backend`, `frontend`, `postgres`, and `redis`. Redis will be used for the job queue.
- `backend/package.json`: Will need updates for new dependencies (job queue library) and potentially a worker script.

## Discovered Documentation
- `./GEMINI_README.md`: General project README.
- `./frontend/README.md`: Frontend-specific README.
- `./README.md`: Main project README.
- `./skills/README.md`: Documentation for skills.
- `./.planning/codebase/ARCHITECTURE.md`: High-level architectural overview.
- `./.planning/codebase/TESTING.md`: Information regarding project testing.

## Task Details (from task-01-implement-job-queue-module.code-task.md)
**Description:** Set up a job queue system to handle background tasks for PDF processing. This module will be responsible for defining job types, enqueuing new jobs, and providing an interface for workers to process these jobs. The system should leverage Redis for its queueing capabilities.
**Technical Requirements:**
1. Choose and integrate a job queue library (e.g., BullMQ) or implement a basic custom queue using Redis.
2. Define a job type for 'processPdfUpload' that includes necessary data (e.g., userId, filePath, password, jobId).
3. Create a function to enqueue a new 'processPdfUpload' job.
4. Create an interface or function to allow a worker to process jobs of this type.
5. Ensure robust error handling and logging within the job queue operations.

## Implementation Details & Patterns

### Chosen Job Queue Library
**BullMQ** has been selected as the job queue library due to its robustness, feature set, and good integration with Redis, which is already part of the project's Docker Compose setup. `ioredis` is already a dependency in `backend/package.json`, which BullMQ uses.

### Dependencies to Add
- `bullmq`: Will be added to `backend/package.json`.

### Module Structure (`backend/src/jobs/queue.ts`)
This file will contain:
-   Initialization of the BullMQ `Queue` instance, connecting to Redis using environment variables (`REDIS_HOST`, `REDIS_PORT`).
-   An interface for `ProcessPdfUploadJobData` defining the payload for PDF processing jobs (e.g., `userId`, `filePath`, `password`, `jobId`).
-   An asynchronous function, `addProcessPdfJob`, to enqueue new jobs of type `processPdfUpload` with the specified data.

### Redis Connection
The Redis connection for BullMQ will use `REDIS_HOST` and `REDIS_PORT` environment variables, which are configured in `docker-compose.yml` to point to the `redis` service.

### Error Handling
The module will include basic error handling for queue operations, logging any issues that occur during job enqueueing or queue initialization.
