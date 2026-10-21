import { render, screen } from '@testing-library/react';
import { SimulationModal } from './SimulationModal';
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../api', () => ({
  default: {
    post: vi.fn(),
  },
  API_ENDPOINTS: {
    TAX: '/api/tax',
  },
}));

describe('SimulationModal', () => {
  const baseFolio = {
    id: 'f1',
    asset: { name: 'Parag Parikh Flexi Cap Fund', type: 'MUTUAL_FUND' },
    metrics: { currentPrice: 100 },
  };

  it('does NOT show "Incomplete History" warning when transactions are regular purchases since 1 Jan 2023', () => {
    const folio = {
      ...baseFolio,
      transactions: [
        { type: 'BUY', units: 50, nav: 80, date: '2023-01-01', amount: 4000 },
        { type: 'PURCHASE_SIP', units: 50, nav: 90, date: '2023-02-01', amount: 4500 },
      ],
    };

    render(<SimulationModal folio={folio} onClose={() => {}} taxSlab={0.3} />);

    expect(screen.queryByText(/Incomplete History/i)).toBeNull();
  });

  it('does NOT show "Incomplete History" warning when a 0-unit OPENING_BALANCE transaction is present', () => {
    const folio = {
      ...baseFolio,
      transactions: [
        { type: 'OPENING_BALANCE', units: 0, nav: 0, date: '2023-01-01', amount: 15 },
        { type: 'BUY', units: 100, nav: 80, date: '2023-01-05', amount: 8000 },
      ],
    };

    render(<SimulationModal folio={folio} onClose={() => {}} taxSlab={0.3} />);

    expect(screen.queryByText(/Incomplete History/i)).toBeNull();
  });

  it('shows "Incomplete History" warning when active holdings rely on positive OPENING_BALANCE anchor units', () => {
    const folio = {
      ...baseFolio,
      transactions: [
        { type: 'OPENING_BALANCE', units: 50, nav: 50, date: '2023-01-01', amount: 2500 },
        { type: 'BUY', units: 50, nav: 80, date: '2023-02-01', amount: 4000 },
      ],
    };

    render(<SimulationModal folio={folio} onClose={() => {}} taxSlab={0.3} />);

    expect(screen.getByText(/Incomplete History:/i)).toBeInTheDocument();
  });

  it('does NOT crash when a transaction has an undefined type (regression: TypeError toLowerCase)', () => {
    // Simulates a manual asset or edge-case folio whose transaction lacks a `type` field
    const folio = {
      ...baseFolio,
      transactions: [
        { type: undefined, units: 50, nav: 80, date: '2023-01-01', amount: 4000 },
        { type: 'BUY', units: 50, nav: 90, date: '2023-02-01', amount: 4500 },
      ],
    };

    // Should render without throwing — no blank page crash
    expect(() =>
      render(<SimulationModal folio={folio} onClose={() => {}} taxSlab={0.3} />)
    ).not.toThrow();

    // Modal header must be visible (not a blank page)
    expect(screen.getByText(/Withdrawal Simulation/i)).toBeInTheDocument();
  });
});
