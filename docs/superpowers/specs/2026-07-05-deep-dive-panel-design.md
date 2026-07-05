# Deep Dive Panel Design Spec

## Overview
This feature introduces a "Deep Dive" ability on each stock in the X-Ray view and mutual funds in the main holdings view. It will provide users with detailed contextual data including latest news, TER, PE ratio, and sentiment.

## User Experience & UI Components
- **Trigger:** Clicking on an asset (stock or mutual fund) row in the main holdings view or X-Ray view.
- **Component:** A `SlideOutPanel` component that slides in from the right edge of the screen, preserving the user's current context.
- **Layout:** The panel uses Tabbed Navigation.
    - **Overview Tab:** Basic asset details, current price, mini chart.
    - **Fundamentals Tab:** 
        - For Stocks: PE Ratio, P/B Ratio, Dividend Yield.
        - For Mutual Funds: TER (Total Expense Ratio), AUM, Exit Load.
    - **News & Sentiment Tab:** Recent positive and negative news articles sourced from the web, with sentiment badges.

## Architecture & Data Flow
1. **Frontend Request:** The React frontend makes a single HTTP GET request to the backend for deep-dive data, passing the asset symbol/identifier.
2. **Backend API:** A new set of Express routes will be created: `GET /api/analytics/deepdive/:symbol`.
3. **External APIs:** The backend will fetch raw data from external APIs (e.g., Yahoo Finance for fundamentals, NewsAPI for news).
4. **Caching Layer:** To optimize performance, respect API rate limits, and protect API keys, the backend will cache external API responses in Redis. 
    - Fundamentals will be cached for 24 hours.
    - News & Sentiment will be cached for 4-6 hours.
5. **Response:** The backend aggregates this data and returns it to the frontend.

## Error Handling & Edge Cases
- **External API Failures:** If an external API fails, times out, or rate-limits the backend, the backend will return a graceful error or partial data.
- **Frontend Fallback:** The side panel will display the data it successfully retrieved and show a clean error state (e.g., "News currently unavailable") for the missing sections, ensuring the user experience is not entirely broken by a third-party failure.

## Implementation Guidelines
- Place the side panel component inside the existing feature directories (e.g., `frontend/src/features/holdings/components`).
- Extend existing caching utilities in the backend (`backend/src/services/cache.service.ts` or similar).
- API keys for external services must be provided via the `.env` file and never exposed to the frontend.

## Testing Strategy
- **Backend Functional Tests (Hermetic):** 
  - Comprehensive unit/functional tests using mocked external API responses to ensure the backend data processing, caching logic, and error handling work predictably without making real network requests.
  - Mock existing database dependencies per project guidelines (`jest.mock('@src/services/db.service', () => require('@src/test/db.mock'))`).
- **Frontend E2E Tests (Playwright):** 
  - Extend the existing Playwright suite to test the Deep Dive Panel.
  - The tests will cover the slide-out panel trigger, the tab navigation (Overview, Fundamentals, News), and graceful error states.
  - To ensure stability and prevent flakiness, external API calls will be intercepted/mocked within Playwright (`page.route`), so network latency or third-party outages do not fail the E2E tests.
