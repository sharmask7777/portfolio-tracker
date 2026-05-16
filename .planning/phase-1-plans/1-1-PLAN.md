# Phase 1, Task 1: Project Skeleton & Environment Setup

## Objective
Initialize the monorepo structure with a React (TypeScript) frontend and a Node.js (Express/TypeScript) backend. Set up the development environment, including Docker for PostgreSQL and Redis.

## Given
*   Empty workspace.
*   Tech stack: React, Node.js, TypeScript, PostgreSQL, Redis.

## When
1.  Initialize a Git repository.
2.  Create a `backend/` directory and initialize a Node.js project with TypeScript, Express, and essential middleware (cors, helmet, morgan).
3.  Create a `frontend/` directory and initialize a React project using Vite with TypeScript.
4.  Configure `eslint` and `prettier` for the entire workspace.
5.  Create a `docker-compose.yml` file for PostgreSQL and Redis.
6.  Set up basic health-check endpoints for the backend.

## Then
*   The project should have a clear monorepo structure.
*   `npm run dev` in both folders should start the respective services.
*   Database and Redis should be accessible via Docker.
*   All code should pass linting and formatting checks.
