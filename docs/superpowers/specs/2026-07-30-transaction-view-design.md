# Transaction Side Panel Design

## Goal
Provide a view where users can click a mutual fund in their portfolio and see a detailed list of all historical transactions (buy/sell) for that fund.

## Scope
- Add interactivity to the mutual fund table rows.
- Build a new side panel component for transaction history.
- Ensure the panel is fully responsive (acts as a full-screen drawer on mobile).

## UI/UX Architecture

1. **Trigger mechanism:**
   - In `App.tsx` (or the component rendering the portfolio table), the mutual fund row (or a specific column, like the name) will be clickable.
   - When clicked, it sets a state variable `selectedFolioForTransactions`.

2. **TransactionSidePanel Component:**
   - A new component `TransactionSidePanel.tsx` in `frontend/src/components/Dashboard/`.
   - Takes `folio` and `onClose` props.
   - Renders an overlay mask (to close when clicking outside).
   - Renders a sliding drawer on the right side of the screen.
   - On small screens (mobile), it takes up 100% width. On desktop, ~400px width.
   - **Header:** Folio name, current value, total units, and a Close (X) button.
   - **Body:** A scrollable list of transactions. Each transaction shows Date, Type (Buy/Sell), Amount, NAV, and Units.

## Data Flow
- The portfolio API endpoint (`/api/portfolio/...`) already returns folios with a nested `transactions` array, which the backend uses to compute XIRR.
- The frontend will utilize this pre-fetched `folio.transactions` data, passing it directly into the `TransactionSidePanel`.
- No additional API endpoints need to be created or called when opening the panel.

## Implementation Steps
1. Create `TransactionSidePanel.tsx` and its CSS (or add styles to `index.css`).
2. Update `App.tsx` to include state for the selected folio.
3. Update the table row in `App.tsx` to handle clicks and trigger the side panel.
4. Render the `TransactionSidePanel` if `selectedFolioForTransactions` is not null.

## Out of Scope
- Editing or deleting individual transactions from the panel (transactions are read-only from the PDF parse for now, except for full manual assets which have a separate delete button).
- Adding new transactions from the panel.
