# Data Integrity

## Idempotency Vulnerabilities in SyncService
The `SyncService` is responsible for ingesting parsed CAS transactions into the database. Currently, its idempotency checks are insufficient.

## MD5 Hash Collision Risks
The system generates an MD5 hash to uniquely identify transactions and prevent duplicates. While it includes `portfolioId`, `folio`, `isin`, `date`, `type`, `amount`, `units`, and `nav`, a collision risk still exists for perfectly identical, same-day duplicate transactions.
- **Risk:** If a user has identical, legitimate same-day transactions (e.g., two identical SIPs or SWPs processed on the exact same date for the same scheme with the same amount and units), the MD5 hash will collide. The system will incorrectly treat the second transaction as a duplicate and discard/override it, leading to missing units and inaccurate data.
- **Fix Required:** The hashing algorithm must include additional entropy, such as the balance or the order of occurrence in the source file, to ensure true uniqueness for identical same-day transactions.
