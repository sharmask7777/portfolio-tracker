import { render, screen } from '@testing-library/react';
import { SimulationModal } from './SimulationModal';
import { describe, it, expect, vi } from 'vitest';
import type { FolioView } from '../../types/generated';

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

  it('does not throw TypeError when transactions have missing type or zero price', () => {
    const incompleteFolio: FolioView = {
      id: 'f1',
      name: 'Test Fund',
      metrics: { currentPrice: 0 },
      transactions: [{ date: '2024-01-01', nav: 50 }], // no 'type' field
    };
    expect(() => {
      render(<SimulationModal folio={incompleteFolio} onClose={() => {}} taxSlab={0.3} />);
    }).not.toThrow();
  });

  it('guards against NaN dates when sorting transactions in getPrice', () => {
    const invalidDateFolio: FolioView = {
      id: 'f1',
      name: 'Test Fund',
      metrics: { currentPrice: 0 },
      transactions: [
        { date: 'invalid-date', nav: 50 },
        { date: '2024-01-01', nav: 60 },
      ],
    };
    expect(() => {
      render(<SimulationModal folio={invalidDateFolio} onClose={() => {}} taxSlab={0.3} />);
    }).not.toThrow();
  });

  it('renders Budget 2024 LTCG (12.5%), STCG (20%), Cess (4%), and Exit Load when simulation succeeds', async () => {
    const api = (await import('../../api')).default;
    const mockPost = vi.mocked(api.post);
    mockPost.mockResolvedValueOnce({
      data: {
        assetName: 'Parag Parikh Flexi Cap Fund',
        unitsToSell: 100,
        estimatedValue: 10000,
        totalGain: 4000,
        taxableGain: 4000,
        estimatedTax: 520, // 500 base tax + 20 cess
        exitLoad: 100,
        taxBreakdown: {
          stcg: { amount: 0, tax: 0, cess: 0 },
          ltcg: { amount: 4000, tax: 500, cess: 20 },
          slab: { amount: 0, tax: 0, cess: 0 },
          totalTax: 520,
        },
        matchedLots: [
          {
            tax_type: 'Ltcg',
            tax_rate: 0.125,
            gain: 4000,
            tax_before_cess: 500,
            cess: 20,
            estimated_tax: 520,
          },
        ],
      },
    });

    const folio = {
      ...baseFolio,
      transactions: [
        { type: 'BUY', units: 100, nav: 60, date: '2023-01-01', amount: 6000 },
      ],
    };

    render(
      <SimulationModal
        folio={folio}
        initialUnits={100}
        onClose={() => {}}
        taxSlab={0.3}
      />
    );

    // Verify 12.5% rate label
    expect(await screen.findByText(/LTCG Tax Estimate \(12\.5%\):/i)).toBeInTheDocument();
    // Verify 20% STCG label
    expect(screen.getByText(/STCG Tax Estimate \(20%\):/i)).toBeInTheDocument();
    // Verify 4% Cess label
    expect(screen.getByText(/Health & Education Cess \(4%\):/i)).toBeInTheDocument();
    // Verify Exit Load row
    expect(screen.getByText(/Exit Load:/i)).toBeInTheDocument();
    // Verify footnote mentions Budget 2024
    expect(screen.getByText(/Tax estimates reflect Budget 2024 statutory rates/i)).toBeInTheDocument();
  });
});
