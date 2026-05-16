# Phase 1, Task 2: CAMS CAS Parsing Service

## Objective
Implement a robust parsing service to extract data from CAMS/Karvy CAS PDF files.

## Given
*   A `backend/` service with TypeScript.
*   Python available in the environment (for `casparser` library).

## When
1.  Implement a file upload endpoint in the backend to receive PDF statements.
2.  Set up a Python bridge or a microservice that utilizes the `casparser` library to extract data from the PDF.
3.  The parser must handle password-protected PDFs (provided by the user).
4.  Normalize the extracted JSON data into a standard internal format (Investor Info, Folios, Schemes, Transactions).
5.  Implement comprehensive error handling for malformed or unsupported PDF layouts.
6.  Write unit tests for the parsing logic using sample data or mock PDF outputs.

## Then
*   The backend should expose an endpoint that accepts a CAS PDF and a password.
*   The endpoint should return a structured JSON representation of the entire portfolio.
*   The parsing should be accurate and handle both CAMS and KFintech (Karvy) formats.
