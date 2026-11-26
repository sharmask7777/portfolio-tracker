import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { DragWaterfall } from './DragWaterfall';
import type { StatsMetrics } from './StatsGrid';
import type { DragDecompositionDto } from '../../types/generated/DragDecompositionDto';

const baseMetrics = {
  totalInvested: 100000,
  totalValue: 120000,
  postTaxTotalValue: 115000,
  totalGain: 20000,
  absoluteReturn: 20,
  xirr: 12.5,
  postTaxXirr: 10.5,
  realPostTaxXirr: 4.5,
  portfolioCount: 1,
} as unknown as StatsMetrics;

const formatPercent = (val: unknown) => `${Number(val ?? 0).toFixed(2)}%`;

describe('DragWaterfall', () => {
  it('renders 6-stage waterfall when drags.stages has 6 items', () => {
    const drags: DragDecompositionDto = {
      nominalXirr: 0.125,
      postTaxXirr: 0.105,
      debtDrag: -0.005,
      equityDrag: -0.01,
      cessAndOtherDrag: -0.005,
      inflationDrag: -0.06,
      totalTaxDrag: 0.02,
      totalOverallDrag: 0.08,
      realPostTaxXirr: 0.045,
      benchmarkSpread: 0.01,
      stages: [
        { step: 1, key: 'nominal', label: 'Nominal Gross XIRR', rate: 0.125, drag: 0, description: 'Gross' },
        { step: 2, key: 'debt', label: 'Sec 50AA Debt Tax', rate: 0.12, drag: -0.005, description: 'Debt' },
        { step: 3, key: 'equity', label: 'Sec 112A Equity Tax', rate: 0.11, drag: -0.01, description: 'Equity' },
        { step: 4, key: 'cess', label: 'Cess & Overheads', rate: 0.105, drag: -0.005, description: 'Cess' },
        { step: 5, key: 'inflation', label: 'CPI Inflation', rate: 0.045, drag: -0.06, description: 'CPI' },
        { step: 6, key: 'real', label: 'Real Post-Tax XIRR', rate: 0.045, drag: 0.08, description: 'Real' },
      ],
    };

    render(
      <DragWaterfall
        metrics={baseMetrics}
        drags={drags}
        marginalTaxBracket={0.3}
        formatPercent={formatPercent}
      />
    );

    expect(screen.getByText(/1\. Nominal Gross XIRR/)).toBeInTheDocument();
    expect(screen.getByText(/6\. Real Post-Tax XIRR/)).toBeInTheDocument();
  });

  it('renders fallback view when drags is null', () => {
    render(
      <DragWaterfall
        metrics={baseMetrics}
        drags={null}
        marginalTaxBracket={0.3}
        formatPercent={formatPercent}
      />
    );

    expect(screen.getByText(/1\. Gross Nominal/i)).toBeInTheDocument();
  });
});
