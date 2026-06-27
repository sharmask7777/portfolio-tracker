# External API Resilience

## Lack of Robust Retry Mechanisms
Currently, the Axios requests made to external data providers (`mfapi.in`, FinAPI, Gold API) lack advanced resilience patterns.
- There is no **exponential backoff** or circuit breaker implemented. Network blips or rate limits from upstream providers can cause the sync jobs to fail outright.

## The "0 NAV" Fallback Bug
A known issue exists where a failure to fetch the latest NAV from `mfapi.in` sometimes results in the system defaulting the NAV to `0`.
- **Cascading Impact:** A `0` NAV cascades through the system, artificially wiping out the valuation of the affected scheme and distorting the total portfolio net worth and XIRR calculations. This must be addressed by ensuring the system falls back to the *last known valid NAV*.
