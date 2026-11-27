# Task: Implement Job Status Tracking in Database

## Description
Create a new Prisma model, `UploadJob`, to track the status and metadata of each asynchronous PDF upload job. This model will store critical information such as the job's unique ID, the associated user, the temporary file path, the current status (PENDING, PROCESSING, COMPLETED, FAILED), and timestamps for tracking progress and errors.

## Background
For asynchronous processing, the frontend needs a way to query the status of a submitted job. This requires a persistent record in the database that the backend worker can update and a new API endpoint can query.

## Reference Documentation
**Required:**
- Design: (This task is part of a larger design for asynchronous processing, no single design doc yet)

**Additional References (if relevant to this task):**
- `backend/prisma/schema.prisma`
- Prisma documentation on model definition and migrations.

**Note:** You MUST read the detailed design document before beginning implementation. Read additional references as needed for context.

## Technical Requirements
1. Define a new Prisma model named `UploadJob` in `backend/prisma/schema.prisma`.
2. The `UploadJob` model should include fields for:
    a. `id` (String, @id, @default(uuid())) - The unique job identifier.
    b. `userId` (String) - ID of the user who initiated the upload.
    c. `filePath` (String) - Path to the temporary uploaded file.
    d. `status` (Enum: `UploadJobStatus`) - Current status of the job (e.g., PENDING, PROCESSING, COMPLETED, FAILED).
    e. `message` (String?, optional) - A message or description, especially for error details.
    f. `createdAt` (DateTime, @default(now()))
    g. `updatedAt` (DateTime, @updatedAt)
    h. `startedAt` (DateTime?, optional)
    i. `completedAt` (DateTime?, optional)
3. Define an `enum` for `UploadJobStatus` with values like `PENDING`, `PROCESSING`, `COMPLETED`, `FAILED`.
4. Run a Prisma migration to apply the new model to the database.

## Dependencies
- Prisma ORM.

## Implementation Approach
1. Open `backend/prisma/schema.prisma`.
2. Add the `enum UploadJobStatus` definition.
3. Add the `model UploadJob` definition with the specified fields.
4. Generate a new Prisma migration: `npx prisma migrate dev --name add_upload_job_model`.
5. Apply the migration.

## Acceptance Criteria

1. **Model Definition**
   - Given `backend/prisma/schema.prisma`
   - When the new `UploadJob` model and `UploadJobStatus` enum are defined
   - Then they match the specified fields and enum values.

2. **Database Migration**
   - Given the Prisma schema is updated
   - When a Prisma migration is run
   - Then a new table `UploadJob` is created in the database with the correct columns and types.

3. **Status Field Functionality**
   - Given an `UploadJob` record
   - When its `status` field is updated
   - Then the update is persisted correctly in the database, reflecting the job's lifecycle.

## Metadata
- **Complexity**: Low
- **Labels**: Database, Prisma, Schema, Migration, Backend
- **Required Skills**: Prisma ORM, SQL (basic understanding for schema verification).