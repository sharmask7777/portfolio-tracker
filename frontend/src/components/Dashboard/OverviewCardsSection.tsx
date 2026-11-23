import React from 'react';
import {
  ResponsiveContainer,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Bar,
} from 'recharts';
import type { ConsolidatedSchemeGroup, PerformanceMode } from '@portfolio/core-view';
import type { StockExposure } from '../../utils/hierarchy-types';
import { HistoricalHighlightsCard } from './HistoricalHighlightsCard';

interface OverviewCardsSectionProps {
  portfolioId: string;
  schemeGroups: readonly ConsolidatedSchemeGroup[];
  performanceMode: PerformanceMode;
  exposures: StockExposure[];
}

function isValidNumber(val: unknown): val is number {
  return typeof val === 'number' && !isNaN(val);
}

function formatCurrency(val: unknown): string {
  if (!isValidNumber(val)) return 'N/A';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(val);
}

function formatPercent(val: unknown): string {
  if (!isValidNumber(val)) return 'N/A';
  return `${(val * 100).toFixed(2)}%`;
}

function SchemeBreakdownCard({ schemeGroups }: { schemeGroups: readonly ConsolidatedSchemeGroup[] }) {
  const chartData = schemeGroups.map((g) => ({
    name: g.schemeName,
    value: g.metrics.currentValue,
  }));

  return (
    <div className="card">
      <h3>Scheme Breakdown</h3>
      <div className="chart-container" style={{ marginTop: '1rem' }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 11 }}
              interval={0}
              angle={-45}
              textAnchor="end"
              height={60}
            />
            <YAxis
              tick={{ fontSize: 11 }}
              tickFormatter={(val) => `₹${(val / 100000).toFixed(1)}L`}
            />
            <Tooltip
              contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
              formatter={(val: unknown) => formatCurrency(Number(val))}
            />
            <Bar dataKey="value" fill="var(--accent-color)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function KeyInsightsCard({
  schemeGroups,
  performanceMode,
  exposures,
}: {
  schemeGroups: readonly ConsolidatedSchemeGroup[];
  performanceMode: PerformanceMode;
  exposures: StockExposure[];
}) {
  const activeGroups = schemeGroups.filter((g) => g.metrics.currentValue >= 1.0);
  const sorted = [...activeGroups].sort((a, b) => {
    const aVal = performanceMode === 'XIRR' ? a.metrics.xirr : a.metrics.absoluteReturn;
    const bVal = performanceMode === 'XIRR' ? b.metrics.xirr : b.metrics.absoluteReturn;
    return bVal - aVal;
  });
  const top = sorted[0];
  const value = top ? (performanceMode === 'XIRR' ? top.metrics.xirr : top.metrics.absoluteReturn) : 0;
  const topExposure = exposures[0];

  return (
    <div className="card">
      <h3>Key Insights</h3>
      <div style={{ marginTop: '1rem' }}>
        {top && (
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            Your top performing asset is <strong>{top.schemeName}</strong> with {performanceMode === 'XIRR' ? 'an XIRR' : 'a return'} of <span className="positive">{formatPercent(value)}</span>.
          </p>
        )}
        <div style={{ marginTop: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
          <p style={{ fontSize: '0.875rem', fontWeight: 600 }}>Top Stock Exposure</p>
          {topExposure ? (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem' }}>
              <span style={{ fontSize: '0.875rem' }}>{topExposure.name}</span>
              <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>{formatPercent(topExposure.percentage)}</span>
            </div>
          ) : (
            <div style={{ marginTop: '0.5rem', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
              No equity exposures identified
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Mid-page analytical cards section: Scheme breakdown bar chart, key insights, and historical highlights.
 */
export const OverviewCardsSection: React.FC<OverviewCardsSectionProps> = ({
  portfolioId,
  schemeGroups,
  performanceMode,
  exposures,
}) => {
  return (
    <div className="dashboard-sections">
      <SchemeBreakdownCard schemeGroups={schemeGroups} />
      <KeyInsightsCard
        schemeGroups={schemeGroups}
        performanceMode={performanceMode}
        exposures={exposures}
      />
      <HistoricalHighlightsCard portfolioId={portfolioId} />
    </div>
  );
};
