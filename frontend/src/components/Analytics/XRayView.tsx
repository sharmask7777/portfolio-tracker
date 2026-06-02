import React from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Treemap, 
  PieChart, 
  Pie, 
  Cell, 
  Legend 
} from 'recharts';

interface XRayViewProps {
  data: any;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#6366f1'];

const XRayDashboard = ({ data, title }: { data: any, title: string }) => {
  const sectorData = data.sectors.map((s: any) => ({
    name: s.name,
    size: s.value,
    percentage: s.percentage,
  }));

  const marketCapData = [
    { name: 'Large Cap', value: (data.marketCap?.large?.percentage || 0) * 100 },
    { name: 'Mid Cap', value: (data.marketCap?.mid?.percentage || 0) * 100 },
    { name: 'Small Cap', value: (data.marketCap?.small?.percentage || 0) * 100 },
  ];

  const assetData = [
    { name: 'Equity', value: data.assetAllocation?.equity?.percentage || 0 },
    { name: 'Debt', value: data.assetAllocation?.debt?.percentage || 0 },
    { name: 'Cash', value: data.assetAllocation?.cash?.percentage || 0 },
    { name: 'Gold', value: data.assetAllocation?.gold?.percentage || 0 },
    { name: 'Arbitrage', value: data.assetAllocation?.arbitrage?.percentage || 0 },
  ].filter(a => a.value > 0);

  return (
    <div style={{ marginBottom: '3rem' }}>
      <h2 style={{ marginBottom: '1.5rem', color: 'var(--text-primary)', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>{title}</h2>
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h3>Sector Allocation</h3>
        <div className="treemap-container" style={{ marginTop: '1rem', height: '400px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <Treemap
              data={sectorData}
              dataKey="size"
              aspectRatio={4 / 3}
              stroke="#fff"
              fill="var(--accent-color)"
            >
              <Tooltip 
                formatter={(_: any, __: any, props: any) => [
                  `${(props.payload.percentage * 100).toFixed(2)}%`, 
                  props.payload.name
                ]}
              />
            </Treemap>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="xray-grid">
        <div className="card">
          <h3>Market Cap Breakdown</h3>
          <div className="chart-container" style={{ marginTop: '1rem', height: '300px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={marketCapData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="var(--border-color)" />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" width={100} stroke="var(--text-secondary)" fontSize={12} />
                <Tooltip formatter={(val: any) => `${Number(val).toFixed(2)}%`} />
                <Bar dataKey="value" fill="var(--accent-color)" radius={[0, 4, 4, 0]} barSize={30} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <h3>Asset Allocation</h3>
          <div className="pie-container" style={{ marginTop: '1rem', height: '300px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={assetData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {assetData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(val: any) => `${(Number(val) * 100).toFixed(2)}%`} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

const ExpenseAnalysis = ({ data }: { data: any }) => {
  if (!data || !data.expenseAnalysis) return null;
  const { totalAnnualFees, weightedAvgTer, categoryBreakdown } = data.expenseAnalysis;
  
  const formatCurrency = (val: number) => {
    if (typeof val !== 'number' || isNaN(val)) return 'N/A';
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val);
  };
  
  const formatPercent = (val: number) => {
    if (typeof val !== 'number' || isNaN(val)) return 'N/A';
    return `${val.toFixed(2)}%`;
  };

  return (
    <div className="card" style={{ marginBottom: '1.5rem' }}>
      <h3>Expense Analysis</h3>
      
      <div style={{ display: 'flex', gap: '2rem', marginTop: '1rem', marginBottom: '1.5rem' }}>
        <div>
          <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Total Fees Paid (Annualized)</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{formatCurrency(totalAnnualFees)}</div>
        </div>
        <div>
          <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Weighted Average TER</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{formatPercent(weightedAvgTer)}</div>
        </div>
      </div>

      <h4>Fund Category Breakdown</h4>
      <div style={{ overflowX: 'auto', marginTop: '1rem' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
              <th style={{ padding: '0.75rem 0', color: 'var(--text-secondary)' }}>Category Name</th>
              <th style={{ padding: '0.75rem 0', textAlign: 'right', color: 'var(--text-secondary)' }}>Total Fees Paid</th>
              <th style={{ padding: '0.75rem 0', textAlign: 'right', color: 'var(--text-secondary)' }}>Average TER</th>
            </tr>
          </thead>
          <tbody>
            {(categoryBreakdown || []).map((cat: any, i: number) => (
              <tr key={i} style={{ borderBottom: '1px solid var(--border-color)' }}>
                <td style={{ padding: '0.75rem 0' }}>{cat.category || 'Unknown'}</td>
                <td style={{ padding: '0.75rem 0', textAlign: 'right' }}>{formatCurrency(cat.totalFees)}</td>
                <td style={{ padding: '0.75rem 0', textAlign: 'right' }}>{formatPercent(cat.avgTer)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export const XRayView: React.FC<XRayViewProps> = ({ data }) => {
  if (!data || !data.sectors) return <div className="loading-state">Loading X-Ray data...</div>;

  if (data.totalValue === 0) {
    return (
      <div className="empty-state">
        <h3>No X-Ray Data Available</h3>
        <p>Ensure your portfolio has active holdings with valid ISINs.</p>
      </div>
    );
  }

  return (
    <div className="xray-view animate-fade">
      <ExpenseAnalysis data={data} />
      <XRayDashboard data={data} title="Standard View" />
      {data.exArbitrage && data.exArbitrage.assetAllocation.arbitrage.value > 0 && (
        <XRayDashboard data={data.exArbitrage} title="Excluding Arbitrage (Black Box)" />
      )}
    </div>
  );
};
