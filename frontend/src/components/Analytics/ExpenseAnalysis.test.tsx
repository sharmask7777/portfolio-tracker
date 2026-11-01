import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ExpenseAnalysis } from './ExpenseAnalysis';
import type { XRayData } from './types';

describe('ExpenseAnalysis Component', () => {
  it('renders nothing when data has no expenseAnalysis', () => {
    const { container } = render(<ExpenseAnalysis data={{} as XRayData} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders correctly with valid expense analysis metrics', () => {
    const mockData: XRayData = {
      totalValue: 100000,
      assetAllocation: {
        equity: { value: 60000, percentage: 60 },
        debt: { value: 30000, percentage: 30 },
        cash: { value: 10000, percentage: 10 },
        gold: { value: 0, percentage: 0 },
        other: { value: 0, percentage: 0 },
      },
      marketCap: {
        large: { value: 40000, percentage: 40 },
        mid: { value: 15000, percentage: 15 },
        small: { value: 5000, percentage: 5 },
      },
      sectors: [],
            expenseAnalysis: {
        totalAnnualFees: 1250,
        weightedAvgTer: 1.25,
        categoryBreakdown: [
          { category: 'Equity: Large Cap', totalFees: 800, avgTer: 1.1, percentage: 60, value: 60000 },
          { category: 'Debt: Liquid', totalFees: 450, avgTer: 0.4, percentage: 40, value: 40000 },
        ],
        fundBreakdown: [],
      },
      fundCategoryAllocation: {
        active: { value: 60000, percentage: 60 },
        index: { value: 40000, percentage: 40 },
        arbitrage: { value: 0, percentage: 0 },
        other: { value: 0, percentage: 0 },
      },
    };

    render(<ExpenseAnalysis data={mockData} />);

    expect(screen.getByText('Expense Analysis')).toBeInTheDocument();
    expect(screen.getByText('1.25%')).toBeInTheDocument();
    expect(screen.getByText('Equity: Large Cap')).toBeInTheDocument();
    expect(screen.getByText('Debt: Liquid')).toBeInTheDocument();
  });

  it('handles empty categoryBreakdown and non-number values gracefully', () => {
    const mockData: XRayData = {
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
        totalAnnualFees: NaN,
        weightedAvgTer: NaN,
        categoryBreakdown: [
          { category: '', totalFees: 0, avgTer: 0, percentage: 0, value: 0 },
        ],
        fundBreakdown: [],
      },
      fundCategoryAllocation: {
        active: { value: 0, percentage: 0 },
        index: { value: 0, percentage: 0 },
        arbitrage: { value: 0, percentage: 0 },
        other: { value: 0, percentage: 0 },
      },
    };

    render(<ExpenseAnalysis data={mockData} />);
    expect(screen.getByText('Unknown')).toBeInTheDocument();
  });
});
