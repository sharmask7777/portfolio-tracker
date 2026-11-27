# Idea Honing: Portfolio History Engine

This document tracks the requirements clarification process for the Portfolio History Engine.

## Questions & Answers

### 1. What granularity should the portfolio history data have?
**Answer:** Daily. Daily data points for the entire history.

### 2. How should we handle missing NAV data for non-trading days (weekends, holidays)?
**Answer:** Last Available NAV. Use the last available NAV (standard practice).

### 3. What is the default history range we should calculate and serve?
**Answer:** Default should be last 3 months, but expandable to start of investing.

### 4. Where should we store the cached historical data?
**Answer:** Database (PostgreSQL). Use the existing PostgreSQL database to store calculated daily snapshots.

### 5. When should the historical data be calculated?
**Answer:** Background Job. Calculate in a background job when a new CAS is uploaded or daily at night.
