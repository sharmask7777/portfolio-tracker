# Context: CAMS CAS Parsing Service

## Task Overview
Implement a service in the backend to handle the upload of CAMS/Karvy CAS PDF files, parse them using a Python-based utility (`casparser`), and return normalized JSON data.

## Requirements
- Backend endpoint `POST /api/portfolio/upload`.
- Integration with Python virtual environment in `backend/venv`.
- Support for password-protected PDFs.
- Normalization of RTA-specific data into a standard internal format.
- Error handling for invalid passwords, malformed PDFs, and unsupported formats.

## Tech Stack
- Backend: Express (Node.js/TypeScript).
- Parsing: Python 3, `casparser` library.
- Communication: `child_process` (Node.js) to call the Python script.

## Existing Documentation
- `.planning/phase-1-plans/1-2-PLAN.md`: Task definition.

## Implementation Paths
- `backend/src/routes/portfolio.ts`: Upload routes.
- `backend/src/services/parser.service.ts`: Node.js service to manage the Python bridge.
- `backend/scripts/parse_cas.py`: Python script for actual parsing.
