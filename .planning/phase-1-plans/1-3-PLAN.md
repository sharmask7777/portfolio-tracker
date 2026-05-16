# Phase 1, Task 3: Database Schema & Data Persistence

## Objective
Design and implement the PostgreSQL database schema to persist the parsed portfolio data.

## Given
*   PostgreSQL running in Docker.
*   Standardized JSON output from the CAS parser.

## When
1.  Define the database schema using an ORM (Prisma or TypeORM recommended).
2.  Create tables for:
    *   `Users` (Email, Password hash, Preferences).
    *   `Portfolios` (Name, Owner, Currency).
    *   `Assets` (Type: MF/Stock/FD, ISIN, AMFI Code, Symbol, Name).
    *   `Folios` (Number, AMC, PAN).
    *   `Transactions` (Date, Type, Amount, Units, NAV, AssetID, FolioID).
3.  Implement a "Synchronization" service that takes the parsed JSON and upserts data into the database.
4.  Ensure transaction atomicity when importing a full statement (all or nothing).
5.  Implement basic CRUD APIs to retrieve portfolios and transaction history.

## Then
*   Parsed CAS data should be successfully persisted in PostgreSQL.
*   The schema should support multi-asset and multi-folio relationships.
*   Data integrity should be maintained across imports.
