import { render, screen, act, fireEvent } from '@testing-library/react';
import { StatsGrid } from './StatsGrid';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SettingsProvider } from '../../contexts/SettingsContext';

describe('StatsGrid', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  const mockMetrics = {
    totalInvested: 100000,
    totalValue: 150000,
    totalGain: 50000,
    absoluteReturn: 0.5,
    xirr: 0.25,
    postTaxTotalValue: 140000,
    postTaxXirr: 0.20,
    realPostTaxXirr: 0.132,
    drags: {
      nominalXirr: 0.25,
      debtDrag: 0.015,
      equityDrag: 0.035,
      cessAndOtherDrag: 0.005,
      inflationDrag: 0.063,
      realPostTaxXirr: 0.132,
      benchmarkSpread: 0.085,
    },
    estimatedTax: 10000,
    dayChange: 1500,
    dayChangePercentage: 1.0,
  };

  it('renders primary pre-tax metrics in broker view', () => {
    render(
      <SettingsProvider>
        <StatsGrid metrics={mockMetrics} performanceMode="XIRR" />
      </SettingsProvider>
    );

    expect(screen.getByText(/Current Net Worth/)).toBeDefined();
    expect(screen.getByText(/Total Invested/)).toBeDefined();
    expect(screen.getByText(/25.00%/)).toBeDefined();
    expect(screen.getByText(/\+₹1,500/)).toBeDefined();
    expect(screen.getByText(/\(1.00%\)/)).toBeDefined();
    expect(screen.getByText(/Broker View/)).toBeDefined();
    expect(screen.getByText(/Reality Check/)).toBeDefined();
  });

  it('renders symmetric post-tax metrics in broker view', () => {
    render(
      <SettingsProvider>
        <StatsGrid metrics={mockMetrics} performanceMode="XIRR" />
      </SettingsProvider>
    );
    expect(screen.getByText(/After-Tax:/)).toBeDefined();
    expect(screen.getByText(/After-Tax XIRR:/)).toBeDefined();
    expect(screen.getByText(/20.00%/)).toBeDefined();
  });

  it('handles ABS mode metrics in broker view', () => {
    render(
      <SettingsProvider>
        <StatsGrid metrics={mockMetrics} performanceMode="ABS" />
      </SettingsProvider>
    );
    expect(screen.getByText(/Overall ABS/)).toBeDefined();
    expect(screen.getAllByText(/50.00%/).length).toBeGreaterThan(0);
  });

  it('toggles to Reality Check mode, showing dual-readout grounding and drag teardown', () => {
    const onNavigateToTaxMock = vi.fn();
    render(
      <SettingsProvider>
        <StatsGrid
          metrics={mockMetrics}
          performanceMode="XIRR"
          onNavigateToTax={onNavigateToTaxMock}
        />
      </SettingsProvider>
    );

    // Switch to Reality Check mode
    act(() => {
      screen.getByText('Reality Check').click();
    });

    // Net worth updates to Net Realizable Wealth
    expect(screen.getByText(/Net Realizable Wealth/)).toBeDefined();
    expect(screen.getByText(/Gross: ₹1,50,000/)).toBeDefined();
    expect(screen.getByText(/Est\. Tax: -₹10,000/)).toBeDefined();

    // Performance card shows Real Post-Tax XIRR (appears in card and in step 6 of waterfall)
    expect(screen.getByText(/Real Post-Tax XIRR/)).toBeDefined();
    expect(screen.getAllByText('13.20%').length).toBe(2);
    expect(screen.getByText(/Nominal: 25.00%/)).toBeDefined();

    // Stepped waterfall banner is visible
    expect(
      screen.getByText(/Return Drag Teardown: From Nominal Gain to Real Wealth/)
    ).toBeDefined();
    expect(screen.getByText(/1\. Gross Nominal/)).toBeDefined();
    expect(screen.getByText(/2\. Sec 50AA Debt Drag/)).toBeDefined();
    expect(screen.getByText(/-1.50%/)).toBeDefined();
    expect(screen.getByText(/3\. Sec 112A\/111A Equity/)).toBeDefined();
    expect(screen.getByText(/-3.50%/)).toBeDefined();
    expect(screen.getByText(/4\. Cess & Overheads/)).toBeDefined();
    expect(screen.getByText(/-0.50%/)).toBeDefined();
    expect(screen.getByText(/5\. CPI Inflation Drag/)).toBeDefined();
    expect(screen.getByText(/-6.30%/)).toBeDefined();
    expect(screen.getByText(/6\. Real Purchasing XIRR/)).toBeDefined();

    // Benchmark comparison spread
    expect(screen.getByText(/\+8.50%/)).toBeDefined();

    // Action bridge button routes to tax view
    const harvestBtn = screen.getByText(/View Harvesting Ticket/);
    act(() => {
      harvestBtn.click();
    });
    expect(onNavigateToTaxMock).toHaveBeenCalledTimes(1);
  });

  it('renders assumptions popover and updates settings with slider, custom input, and tax buttons', () => {
    render(
      <SettingsProvider>
        <StatsGrid metrics={mockMetrics} performanceMode="XIRR" />
      </SettingsProvider>
    );

    const assumptionsBtn = screen.getByText(/Assumptions: CPI 6% · Slab 30%/);
    act(() => {
      assumptionsBtn.click();
    });

    expect(screen.getByText('Reality Check Assumptions')).toBeDefined();
    expect(screen.getByText('Annual CPI Inflation')).toBeDefined();
    expect(screen.getByText('Marginal Income Tax Slab')).toBeDefined();

    // Click preset RBI 4%
    act(() => {
      screen.getByText('RBI 4%').click();
    });
    expect(screen.getByText(/Assumptions: CPI 4% · Slab 30%/)).toBeDefined();

    // Use custom numeric input
    const cpiInput = screen.getByDisplayValue('4.0');
    act(() => {
      fireEvent.change(cpiInput, { target: { value: '7.5' } });
    });

    // Use range slider
    const slider = screen.getByRole('slider');
    act(() => {
      fireEvent.change(slider, { target: { value: '0.07' } });
    });

    // Click marginal tax slab 20%
    const tax20Btn = screen.getByText('20%');
    act(() => {
      tax20Btn.click();
    });

    // Close button '✕'
    const closeBtn = screen.getByText('✕');
    act(() => {
      closeBtn.click();
    });
    expect(screen.queryByText('Reality Check Assumptions')).toBeNull();

    // Reopen and test click outside
    act(() => {
      screen.getByText(/Assumptions:/).click();
    });
    expect(screen.getByText('Reality Check Assumptions')).toBeDefined();
    act(() => {
      fireEvent.mouseDown(document.body);
    });
    expect(screen.queryByText('Reality Check Assumptions')).toBeNull();
  });

  it('renders negative day change and negative return colors', () => {
    const negativeMetrics = {
      totalInvested: 100000,
      totalValue: 80000,
      totalGain: -20000,
      absoluteReturn: -0.2,
      xirr: -0.15,
      postTaxTotalValue: 80000,
      postTaxXirr: -0.15,
      realPostTaxXirr: -0.21,
      estimatedTax: 0,
      dayChange: -1200,
      dayChangePercentage: -1.5,
    };

    render(
      <SettingsProvider>
        <StatsGrid metrics={negativeMetrics} performanceMode="XIRR" />
      </SettingsProvider>
    );

    expect(screen.getByText(/-₹1,200/)).toBeDefined();
    expect(screen.getByText(/\(-1.50%\)/)).toBeDefined();
    expect(screen.getAllByText('-15.00%').length).toBe(2);
  });

  it('gracefully handles missing optional metrics without NaN or crashing', () => {
    const minimalMetrics = {
      totalInvested: 100000,
      totalValue: 100000,
      totalGain: 0,
      absoluteReturn: 0,
      xirr: 0,
    };

    render(
      <SettingsProvider>
        <StatsGrid metrics={minimalMetrics} performanceMode="XIRR" />
      </SettingsProvider>
    );

    act(() => {
      screen.getByText('Reality Check').click();
    });

    // When realPostTaxXirr is undefined/null, displays em-dash '—' instead of NaN
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
    expect(screen.queryByText(/NaN/)).toBeNull();
  });
});
