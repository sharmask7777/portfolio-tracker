import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ClosedFoliosSection } from './ClosedFoliosSection';
import type { EnrichedFolioView } from '../../types/portfolio';

const closedFolio: EnrichedFolioView = {
  id: 'folio-closed-1',
  number: '123456/78',
  schemeName: 'HDFC Top 100 Fund - Direct Growth',
  pan: 'ABCDE1234F',
  units: 0,
  asset: {
    id: 'a1',
    name: 'HDFC Top 100 Fund - Direct Growth',
    type: 'MUTUAL_FUND',
  },
  metrics: {
    investedAmount: 50000,
    currentValue: 0,
    totalGain: 12000,
    absoluteReturn: 0.24,
    xirr: 0.185,
    postTaxXirr: 0.16,
    postTaxAbsoluteReturn: 0.21,
    currentPrice: 120,
    dayChange: 0,
    dayChangePercentage: 0,
  },
};

describe('ClosedFoliosSection', () => {
  it('renders collapsed header when closedFolios is empty', () => {
    render(
      <ClosedFoliosSection
        closedFolios={[]}
        showClosedFolios={false}
        onToggleShowClosedFolios={vi.fn()}
        onSelectFolioForTransactions={vi.fn()}
        onDeleteFolio={vi.fn()}
      />
    );
    expect(screen.getByText(/Closed \/ Fully Redeemed Positions \(0\)/i)).toBeInTheDocument();
  });

  it('expands, shows closed folio, and triggers delete', () => {
    const onDeleteFolio = vi.fn();
    render(
      <ClosedFoliosSection
        closedFolios={[closedFolio]}
        showClosedFolios={true}
        onToggleShowClosedFolios={vi.fn()}
        onSelectFolioForTransactions={vi.fn()}
        onDeleteFolio={onDeleteFolio}
      />
    );

    expect(screen.getByText(/HDFC Top 100 Fund/i)).toBeInTheDocument();

    fireEvent.click(screen.getByTitle(/Delete Folio/i));
    expect(onDeleteFolio).toHaveBeenCalledWith(closedFolio);
  });
});
