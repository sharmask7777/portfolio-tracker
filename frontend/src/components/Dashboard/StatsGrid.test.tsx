import { render, screen } from '@testing-library/react';
import { StatsGrid } from './StatsGrid';
import { describe, it, expect } from 'vitest';


describe('StatsGrid', () => {
  const mockMetrics = {
    totalInvested: 100000,
    totalValue: 150000,
    totalGain: 50000,
    absoluteReturn: 0.5,
    xirr: 0.25,
    postTaxTotalValue: 140000,
    postTaxXirr: 0.20,
    estimatedTax: 10000
  };

  it('renders primary pre-tax metrics', () => {
    render(<StatsGrid metrics={mockMetrics} performanceMode="XIRR" />);
    // Currency format for 150,000 might include symbols/commas
    expect(screen.getByText(/Current Net Worth/)).toBeDefined();
    expect(screen.getByText(/Total Invested/)).toBeDefined();
    expect(screen.getByText(/25.00%/)).toBeDefined();
  });

  it('renders symmetric post-tax metrics', () => {
    render(<StatsGrid metrics={mockMetrics} performanceMode="XIRR" />);
    expect(screen.getByText(/After-Tax:/)).toBeDefined();
    expect(screen.getByText(/After-Tax XIRR:/)).toBeDefined();
    expect(screen.getByText(/20.00%/)).toBeDefined();
  });

  it('handles ABS mode metrics', () => {
    render(<StatsGrid metrics={mockMetrics} performanceMode="ABS" />);
    expect(screen.getByText(/Overall ABS/)).toBeDefined();
    expect(screen.getAllByText(/50.00%/).length).toBeGreaterThan(0);
  });
});
