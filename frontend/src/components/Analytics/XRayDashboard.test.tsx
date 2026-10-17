import { render, screen } from '@testing-library/react';
import { XRayDashboard, type DashboardData } from './XRayDashboard';
import { describe, it, expect, vi } from 'vitest';

// Mock recharts responsive container and charts
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div data-testid="responsive-container">{children}</div>,
  PieChart: ({ children }: any) => <div data-testid="pie-chart">{children}</div>,
  Pie: ({ data }: any) => (
    <div data-testid="pie-data">
      {data.map((item: any) => (
        <span key={item.name} data-testid={`pie-item-${item.name.toLowerCase()}`}>
          {item.name}: {item.value}
        </span>
      ))}
    </div>
  ),
  Cell: () => null,
  Legend: () => null,
  Tooltip: () => null,
  BarChart: ({ children }: any) => <div>{children}</div>,
  Bar: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Treemap: () => null,
}));

describe('XRayDashboard', () => {
  const sampleData: DashboardData = {
    sectors: [{ name: 'Technology', percentage: 0.5, value: 50000 }],
    marketCap: {
      large: { percentage: 0.6, value: 60000 },
      mid: { percentage: 0.3, value: 30000 },
      small: { percentage: 0.1, value: 10000 },
    },
    assetAllocation: {
      equity: { percentage: 0.7, value: 70000 },
      debt: { percentage: 0.2, value: 20000 },
      cash: { percentage: 0.05, value: 5000 },
      gold: { percentage: 0.05, value: 5000 },
    },
  };

  it('renders Equity, Debt, Cash, and Gold in the asset allocation pie chart', () => {
    render(<XRayDashboard data={sampleData} title="Standard View" />);

    expect(screen.getByText(/Asset Allocation/i)).toBeInTheDocument();
    expect(screen.getByTestId('pie-item-equity')).toHaveTextContent('Equity: 0.7');
    expect(screen.getByTestId('pie-item-debt')).toHaveTextContent('Debt: 0.2');
    expect(screen.getByTestId('pie-item-cash')).toHaveTextContent('Cash: 0.05');
    expect(screen.getByTestId('pie-item-gold')).toHaveTextContent('Gold: 0.05');
  });

  it('renders Other allocation if present and positive', () => {
    const dataWithOther: DashboardData = {
      ...sampleData,
      assetAllocation: {
        ...sampleData.assetAllocation,
        other: { percentage: 0.05, value: 5000 },
      },
    };

    render(<XRayDashboard data={dataWithOther} title="Standard View" />);
    expect(screen.getByTestId('pie-item-other')).toHaveTextContent('Other: 0.05');
  });
});
