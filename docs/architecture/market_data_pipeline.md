# Market Data Pipeline

## MarketDataService
The `MarketDataService` orchestrates the retrieval, parsing, and caching of external financial data necessary for portfolio valuation and X-Ray analysis.

## Integrations
- **api.mfapi.in:** Used to fetch historical Net Asset Values (NAVs) for mutual fund schemes. The pipeline handles bulk upserts of this time-series data into PostgreSQL to keep the local database synchronized.
- **FinAPI:** Utilized for extracting Holdings and Sectoral breakdown data based on scheme ISINs. This powers the X-Ray and Portfolio Overlap features.
- **api.gold-api.com:** Provides real-time and historical gold pricing converted to INR, for accurate tracking of Sovereign Gold Bonds (SGBs) and physical gold assets.
