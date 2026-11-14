import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { XRayView } from './XRayView';
import type { XRayData } from './types';
import type { StockExposure } from './IntersectionView';

// Mock child visualization components so we can test XRayView integration cleanly
vi.mock('./XRayDashboard', () => ({
  XRayDashboard: ({ title }: { title: string }) => <div data-testid="mock-classic-grid">{title}</div>,
}));

describe('XRayView Component', () => {
  const mockValidData: XRayData = {
    totalValue: 1000000,
    assetAllocation: {
      equity: { value: 700000, percentage: 70 },
      debt: { value: 200000, percentage: 20 },
      cash: { value: 50000, percentage: 5 },
      gold: { value: 50000, percentage: 5 },
      other: { value: 0, percentage: 0 },
    },
    marketCap: {
      large: { value: 500000, percentage: 50 },
      mid: { value: 200000, percentage: 20 },
      small: { value: 0, percentage: 0 },
    },
    sectors: [
      { name: 'Financial Services', percentage: 40, value: 280000 },
      { name: 'Technology', percentage: 60, value: 420000 },
    ],
    exArbitrage: {
      assetAllocation: {
        equity: { value: 500000, percentage: 50 },
        debt: { value: 200000, percentage: 20 },
        cash: { value: 50000, percentage: 5 },
        gold: { value: 50000, percentage: 5 },
        arbitrage: { value: 200000, percentage: 20 },
        other: { value: 0, percentage: 0 },
      },
      marketCap: {
        large: { value: 400000, percentage: 40 },
        mid: { value: 100000, percentage: 10 },
        small: { value: 0, percentage: 0 },
      },
      sectors: [
        { name: 'Financial Services', percentage: 40, value: 200000 },
        { name: 'Technology', percentage: 60, value: 300000 },
      ],
    },
    expenseAnalysis: {
      totalAnnualFees: 5000,
      weightedAvgTer: 0.5,
      categoryBreakdown: [],
      fundBreakdown: [],
    },
    fundCategoryAllocation: {
      active: { value: 700000, percentage: 70 },
      index: { value: 300000, percentage: 30 },
      arbitrage: { value: 0, percentage: 0 },
      other: { value: 0, percentage: 0 },
    },
  };

  const mockExposures: StockExposure[] = [
    {
      name: 'HDFC Bank Ltd.',
      sector: 'Financial Services',
      absoluteValue: 150000,
      percentage: 0.15,
      contributions: [
        { schemeName: 'Parag Parikh Flexi Cap Fund', value: 90000, weight: 9.0 },
        { schemeName: 'Kotak Equity Arbitrage Fund', value: 60000, weight: 6.0 },
      ],
    },
    {
      name: 'Infosys Ltd.',
      sector: 'Technology',
      absoluteValue: 200000,
      percentage: 0.20,
      contributions: [
        { schemeName: 'Parag Parikh Flexi Cap Fund', value: 200000, weight: 20.0 },
      ],
    },
  ];

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

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

  it('renders segmented view mode control with Treemap, Sunburst, and Classic Grid buttons', () => {
    render(<XRayView data={mockValidData} exposures={mockExposures} />);

    expect(screen.getByRole('tab', { name: /Zoomable Treemap/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Concentric Sunburst/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Classic Grid/i })).toBeInTheDocument();
  });

  it('defaults to treemap view mode and switches view mode with localStorage persistence', () => {
    render(<XRayView data={mockValidData} exposures={mockExposures} />);

    // Initial treemap rendered
    expect(screen.getByRole('region', { name: /Portfolio Treemap/i })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: /Portfolio Sunburst/i })).not.toBeInTheDocument();
    expect(screen.queryByTestId('mock-classic-grid')).not.toBeInTheDocument();

    // Switch to Sunburst mode
    const sunburstTab = screen.getByRole('tab', { name: /Concentric Sunburst/i });
    fireEvent.click(sunburstTab);

    expect(screen.getByRole('region', { name: /Portfolio Sunburst/i })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: /Portfolio Treemap/i })).not.toBeInTheDocument();
    expect(localStorage.getItem('xray_view_mode')).toBe('sunburst');

    // Switch to Classic Grid mode
    const classicTab = screen.getByRole('tab', { name: /Classic Grid/i });
    fireEvent.click(classicTab);

    expect(screen.getAllByTestId('mock-classic-grid').length).toBeGreaterThan(0);
    expect(localStorage.getItem('xray_view_mode')).toBe('classic');
  });

  it('restores initial view mode from localStorage', () => {
    localStorage.setItem('xray_view_mode', 'sunburst');

    render(<XRayView data={mockValidData} exposures={mockExposures} />);

    expect(screen.getByRole('region', { name: /Portfolio Sunburst/i })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: /Portfolio Treemap/i })).not.toBeInTheDocument();
  });

  it('renders ExpenseAnalysis card above the visualizations', () => {
    render(<XRayView data={mockValidData} exposures={mockExposures} />);

    expect(screen.getByText('Expense Analysis')).toBeInTheDocument();
  });

  it('opens StockDetailDrawer when clicking a stock in Treemap and allows cross-navigating to intersection', () => {
    const handleNavigate = vi.fn();
    render(
      <XRayView
        data={mockValidData}
        exposures={mockExposures}
        onNavigateToIntersection={handleNavigate}
      />
    );

    // Drill into Equity in Treemap
    const equityTile = screen.getByRole('button', { name: /Equity/i });
    fireEvent.click(equityTile);

    // Drill into Financial Services
    const finTile = screen.getByRole('button', { name: /Financial Services/i });
    fireEvent.click(finTile);

    // Click HDFC Bank Ltd. Stock tile
    const stockTile = screen.getByRole('button', { name: /HDFC Bank Ltd\./i });
    fireEvent.click(stockTile);

    // Drawer opens
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'HDFC Bank Ltd.' })).toBeInTheDocument();

    // Click "Inspect in Stock Intersection" CTA
    const inspectBtn = screen.getByRole('button', { name: /Inspect in Stock Intersection/i });
    fireEvent.click(inspectBtn);

    expect(handleNavigate).toHaveBeenCalledWith('HDFC Bank Ltd.');
  });

  it('renders excludeArbitrage toggle when onToggleExcludeArbitrage callback is provided', () => {
    const handleToggle = vi.fn();
    render(
      <XRayView
        data={mockValidData}
        exposures={mockExposures}
        excludeArbitrage={false}
        onToggleExcludeArbitrage={handleToggle}
      />
    );

    const toggle = screen.getByRole('checkbox', { name: /exclude arbitrage/i });
    expect(toggle).toBeInTheDocument();
    expect(toggle).not.toBeChecked();

    fireEvent.click(toggle);
    expect(handleToggle).toHaveBeenCalledWith(true);
  });

  it('handles pure debt / liquid portfolios without equity cleanly', () => {
    const pureDebtData: XRayData = {
      totalValue: 500000,
      assetAllocation: {
        equity: { value: 0, percentage: 0 },
        debt: { value: 450000, percentage: 90 },
        cash: { value: 50000, percentage: 10 },
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
        totalAnnualFees: 1000,
        weightedAvgTer: 0.2,
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

    render(<XRayView data={pureDebtData} exposures={[]} />);

    expect(screen.getByRole('button', { name: /Debt/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Cash & Equivalents/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Equity/i })).not.toBeInTheDocument();
  });
});
