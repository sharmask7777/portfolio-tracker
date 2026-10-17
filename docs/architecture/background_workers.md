# Background Workers

## BullMQ Worker Setup (`worker.ts`)
We use BullMQ (backed by Redis) to manage asynchronous tasks that are either computationally heavy or I/O bound. The main worker logic is defined in `worker.ts`.

## Sequential Offloading
- **PDF Parsing:** Processing CAS PDF files via the Python script can be memory-intensive.
- **Portfolio Sync:** Updating transaction logs and recalculating capital gains requires significant database interaction.
- **Concurrency Control:** To prevent CPU and memory exhaustion (OOM), the BullMQ workers for parsing and sync are configured with a **concurrency of 1**. This ensures sequential processing, providing a stable environment even during high-load periods.

## Shared File Access & Permissions
- **Shared Volume:** The worker container shares the `/app/uploads` directory with the `backend` container via the `shared_uploads` named volume.
- **Workflow:** When a CAS PDF is uploaded, the backend writes the temporary file into `/app/uploads` and dispatches a BullMQ job with the file path. The worker picks up the job, parses the PDF using Python's `casparser`, commits records to PostgreSQL, and unlinks the file (`fs.unlinkSync`).
- **User Permissions:** Both containers run under the non-root user `node` (`UID: 1000`). If using a host bind-mount instead of the named volume, the host folder must have write permissions for UID 1000 to prevent `EACCES` errors.

