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

export interface DashboardData {
  sectors: { name: string; percentage: number; value: number }[];
  marketCap: {
    large: { percentage: number; value: number };
    mid: { percentage: number; value: number };
    small: { percentage: number; value: number };
  };
  assetAllocation: {
    equity?: { percentage: number; value: number };
    debt?: { percentage: number; value: number };
    cash?: { percentage: number; value: number };
    gold?: { percentage: number; value: number };
    arbitrage?: { percentage: number; value: number };
    other?: { percentage: number; value: number };
  };
}

interface XRayDashboardProps {
  data: DashboardData;
  title: string;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#6366f1'];

export const XRayDashboard: React.FC<XRayDashboardProps> = ({ data, title }) => {
  const sectorData = data.sectors.map(s => ({
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
    <div className="xray-dashboard">
      <h2 className="xray-dashboard-title">{title}</h2>
      
      <div className="card xray-section">
        <h3>Sector Allocation</h3>
        <div className="treemap-container">
          <ResponsiveContainer width="100%" height="100%">
            <Treemap
              data={sectorData}
              dataKey="size"
              aspectRatio={4 / 3}
              stroke="#fff"
              fill="var(--accent-color)"
            >
              <Tooltip 
                formatter={(_value: any, _name: any, props: any) => [
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
          <div className="chart-container">
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
          <div className="pie-container">
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
