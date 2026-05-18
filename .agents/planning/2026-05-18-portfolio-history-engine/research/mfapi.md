# Research: MFAPI Historical Data

MFAPI provides historical NAV data for mutual funds in India.

## Endpoint
`https://api.mfapi.in/mf/{scheme_code}`

## Response Format
```json
{
  "meta": {
    "fund_house": "SBI Mutual Fund",
    "scheme_type": "Open Ended Schemes",
    "scheme_category": "Hybrid Scheme - Aggressive Hybrid Fund",
    "scheme_code": 102885,
    "scheme_name": "SBI EQUITY HYBRID FUND - REGULAR PLAN -Growth",
    "isin_growth": "INF200K01107",
    "isin_div_reinvestment": null
  },
  "data": [
    {
      "date": "15-05-2026",
      "nav": "304.56690"
    },
    ...
  ],
  "status": "SUCCESS"
}
```

## Considerations
- **Date Format**: `DD-MM-YYYY`.
- **Sorting**: Newest to oldest.
- **Missing Dates**: No data for weekends/holidays.
- **Precision**: NAV is returned as a string.

## Caching Strategy
- Store historical NAVs in a `HistoricalNAV` table to minimize API calls.
- Fetch in bulk for all assets in a portfolio.
