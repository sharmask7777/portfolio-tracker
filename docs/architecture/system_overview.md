# System Overview

## Tech Stack Breakdown
The application follows a modern, scalable client-server architecture:

- **Frontend:** Built with **React** and bundled using **Vite**. Provides a responsive and interactive user interface for dashboards, X-Ray analytics, and file uploads.
- **Backend:** Powered by **Node.js** with the **Express** framework, offering RESTful APIs to serve frontend requests and coordinate background tasks.
- **Database:** **PostgreSQL** serves as the primary relational database, storing user data, parsed transactions, historical NAVs, and tax logic metadata.
- **Cache & Queue:** **Redis** is used for caching external API responses and powers the BullMQ message queue for background job processing.
