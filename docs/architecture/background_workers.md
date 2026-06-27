# Background Workers

## BullMQ Worker Setup (`worker.ts`)
We use BullMQ (backed by Redis) to manage asynchronous tasks that are either computationally heavy or I/O bound. The main worker logic is defined in `worker.ts`.

## Sequential Offloading
- **PDF Parsing:** Processing CAS PDF files via the Python script can be memory-intensive.
- **Portfolio Sync:** Updating transaction logs and recalculating capital gains requires significant database interaction.
- **Concurrency Control:** To prevent CPU and memory exhaustion (OOM), the BullMQ workers for parsing and sync are configured with a **concurrency of 1**. This ensures sequential processing, providing a stable environment even during high-load periods.
