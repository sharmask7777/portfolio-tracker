import React from 'react';
import {
  Treemap,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';

export interface XRayDashboardData {
  totalValue?: number;
  assetAllocation?: {
    equity?: { percentage: number; value: number };
    debt?: { percentage: number; value: number };
    cash?: { percentage: number; value: number };
    gold?: { percentage: number; value: number };
    arbitrage?: { percentage: number; value: number };
    other?: { percentage: number; value: number };
  };
  sectors: { name: string; percentage: number; value: number }[];
  marketCap?: {
    large?: { percentage: number; value: number };
    mid?: { percentage: number; value: number };
    small?: { percentage: number; value: number };
    other?: { percentage: number; value: number };
  };
}

interface XRayDashboardProps {
  data: XRayDashboardData;
  title: string;
}

interface TreemapPayloadItem {
  payload?: {
    name?: string;
    percentage?: number;
  };
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#6366f1'];

function buildMarketCapItems(marketCap: XRayDashboardData['marketCap']) {
  const large = (marketCap?.large?.percentage ?? 0) * 100;
  const mid = (marketCap?.mid?.percentage ?? 0) * 100;
  const small = (marketCap?.small?.percentage ?? 0) * 100;

  const items = [
    { name: 'Large Cap', value: large },
    { name: 'Mid Cap', value: mid },
    { name: 'Small Cap', value: small },
  ];

  if (marketCap?.other && marketCap.other.value > 0) {
    items.push({ name: 'Other / Unclassified', value: (marketCap.other.percentage ?? 0) * 100 });
  }

  return items;
}

const ASSET_KEYS: Array<{ name: string; key: keyof NonNullable<XRayDashboardData['assetAllocation']> }> = [
  { name: 'Equity', key: 'equity' },
  { name: 'Debt', key: 'debt' },
  { name: 'Cash', key: 'cash' },
  { name: 'Gold', key: 'gold' },
  { name: 'Arbitrage', key: 'arbitrage' },
  { name: 'Other', key: 'other' },
];

function buildAssetItems(alloc: XRayDashboardData['assetAllocation']) {
  if (!alloc) return [];
  return ASSET_KEYS
    .map(({ name, key }) => ({ name, value: alloc[key]?.percentage ?? 0 }))
    .filter(a => a.value > 0);
}

export const XRayDashboard: React.FC<XRayDashboardProps> = ({ data, title }) => {
  const sectorData = data.sectors.map(s => ({
    name: s.name,
    size: s.value,
    percentage: s.percentage,
  }));

  const marketCapData = buildMarketCapItems(data.marketCap);
  const assetData = buildAssetItems(data.assetAllocation);

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
                formatter={(_value: unknown, _name: unknown, props: unknown) => {
                  const item = props as TreemapPayloadItem;
                  const pct = item.payload?.percentage ?? 0;
                  const label = item.payload?.name ?? '';
                  return [`${(pct * 100).toFixed(2)}%`, label];
                }}
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
                <Tooltip formatter={(val: unknown) => `${Number(val).toFixed(2)}%`} />
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
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length] ?? '#3b82f6'} />
                  ))}
                </Pie>
                <Tooltip formatter={(val: unknown) => `${(Number(val) * 100).toFixed(2)}%`} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
