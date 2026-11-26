import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { FolioChildRow } from './FolioChildRow';

describe('FolioChildRow', () => {
  it('renders folio number, units, and valuation', () => {
    render(
      <table>
        <tbody>
          <FolioChildRow
            folio={{
              id: 'f1',
              number: '12345/67',
              schemeName: 'Nifty 50 Index Fund',
              pan: 'ABCDE1234F',
              units: 100,
              asset: { id: 'a1', name: 'Nifty 50 Index Fund', type: 'MUTUAL_FUND' },
              metrics: {
                investedAmount: 10000,
                currentValue: 12000,
                totalGain: 2000,
                absoluteReturn: 0.2,
                xirr: 0.15,
                postTaxXirr: 0.13,
                postTaxAbsoluteReturn: 0.18,
                currentPrice: 120,
                dayChange: 50,
                dayChangePercentage: 0.4,
              },
            }}
            performanceMode="XIRR"
            realityCheckMode={false}
            marginalTaxBracket={0.3}
            cpiInflationRate={0.06}
            isRefetching={false}
            onSelectFolioForTransactions={vi.fn()}
            onSimulateSell={vi.fn()}
            onDeleteManualAsset={vi.fn()}
          />
        </tbody>
      </table>
    );

    expect(screen.getByText(/12345\/67/)).toBeInTheDocument();
  });
});
