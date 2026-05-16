# Plan: CAMS CAS Parsing Service

## Test Strategy
- **Python Script Test**: Run the Python script manually with a mock/sample PDF and verify JSON output.
- **Service Test**: Unit test the `ParserService` by mocking the `spawn` process.
- **API Test**: 
    - Test `POST /api/portfolio/upload` with no file (should fail).
    - Test with non-PDF file (should fail).
    - Test with a sample PDF (mocked or real) and verify the normalized JSON structure.

## Implementation Plan
1.  **Python Script (`backend/scripts/parse_cas.py`)**:
    - Create a script that takes file path and password as arguments.
    - Use `casparser` to extract data.
    - Output the result as JSON to `stdout`.
2.  **Parser Service (`backend/src/services/parser.service.ts`)**:
    - Implement a method `parseCAS(filePath, password)`.
    - Use `child_process.spawn` to run the Python script within the `venv`.
    - Collect and parse the JSON output.
3.  **Route & Middleware**:
    - Set up `multer` to handle PDF uploads.
    - Create `backend/src/routes/portfolio.routes.ts`.
    - Implement the `upload` endpoint.
4.  **Normalization Layer**:
    - Create types for the `casparser` output and the internal format.
    - Implement a mapper to convert `casparser` JSON to the internal `Portfolio` format.
5.  **Integration**:
    - Register the routes in `backend/src/index.ts`.
