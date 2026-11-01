import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { XRayView } from './XRayView';
import type { XRayData } from './types';

describe('XRayView Component', () => {
  it('renders loading state when data is null or missing sectors', () => {
    // @ts-expect-error test invalid prop
    render(<XRayView data={null} />);
    expect(screen.getByText('Loading X-Ray data...')).toBeInTheDocument();
  });

  it('renders empty state when totalValue is 0', () => {
    const emptyData: XRayData = {
      totalValue: 0,
      assetAllocation: {
        equity: { value: 0, percentage: 0 },
        debt: { value: 0, percentage: 0 },
        cash: { value: 0, percentage: 0 },
        gold: { value: 0, percentage: 0 },
        other: { value: 0, percentage: 0 },
      },
      marketCap: {
        large: { value: 0, percentage: 0 },
        mid: { value: 0, percentage: 0 },
        small: { value: 0, percentage: 0 },
      },
      sectors: [],
            expenseAnalysis: {
        totalAnnualFees: 0,
        weightedAvgTer: 0,
        categoryBreakdown: [],
        fundBreakdown: [],
      },
      fundCategoryAllocation: {
        active: { value: 0, percentage: 0 },
        index: { value: 0, percentage: 0 },
        arbitrage: { value: 0, percentage: 0 },
        other: { value: 0, percentage: 0 },
      },
    };

    render(<XRayView data={emptyData} />);
    expect(screen.getByText('No X-Ray Data Available')).toBeInTheDocument();
  });

  it('renders standard view and ex-arbitrage view when present', () => {
    const validData: XRayData = {
      totalValue: 100000,
      assetAllocation: {
        equity: { value: 70000, percentage: 70 },
        debt: { value: 30000, percentage: 30 },
        cash: { value: 0, percentage: 0 },
        gold: { value: 0, percentage: 0 },
        other: { value: 0, percentage: 0 },
      },
      marketCap: {
        large: { value: 50000, percentage: 50 },
        mid: { value: 20000, percentage: 20 },
        small: { value: 0, percentage: 0 },
      },
      sectors: [{ name: 'Financial', percentage: 30, value: 30000 }],
            exArbitrage: {
                assetAllocation: {
          equity: { value: 50000, percentage: 62.5 },
          debt: { value: 30000, percentage: 37.5 },
          cash: { value: 0, percentage: 0 },
          gold: { value: 0, percentage: 0 },
          arbitrage: { value: 20000, percentage: 20 },
          other: { value: 0, percentage: 0 },
        },
        marketCap: {
          large: { value: 50000, percentage: 62.5 },
          mid: { value: 0, percentage: 0 },
          small: { value: 0, percentage: 0 },
        },
        sectors: [{ name: 'Financial', percentage: 30, value: 24000 }],
              },
      expenseAnalysis: {
        totalAnnualFees: 500,
        weightedAvgTer: 0.5,
        categoryBreakdown: [],
        fundBreakdown: [],
      },
      fundCategoryAllocation: {
        active: { value: 70000, percentage: 70 },
        index: { value: 30000, percentage: 30 },
        arbitrage: { value: 0, percentage: 0 },
        other: { value: 0, percentage: 0 },
      },
    };

    render(<XRayView data={validData} />);
    expect(screen.getByText('Standard View')).toBeInTheDocument();
    expect(screen.getByText('Excluding Arbitrage (Black Box)')).toBeInTheDocument();
  });
});
