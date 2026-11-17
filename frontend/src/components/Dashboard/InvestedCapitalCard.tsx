import React from 'react';
import { Briefcase } from 'lucide-react';
import type { StatsMetrics } from './StatsGrid';

interface InvestedCapitalCardProps {
  metrics: StatsMetrics;
  formatCurrency: (val: unknown) => string;
  formatPercent: (val: unknown) => string;
  gainColor: string;
  isPositiveGain: boolean;
}

export const InvestedCapitalCard: React.FC<InvestedCapitalCardProps> = ({
  metrics,
  formatCurrency,
  formatPercent,
  gainColor,
  isPositiveGain,
}) => (
  <div
    className="card"
    style={{
      padding: '1.5rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.5rem',
    }}
  >
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        color: 'var(--text-secondary)',
      }}
    >
      <Briefcase size={18} />
      <span style={{ fontSize: '0.875rem', fontWeight: '500' }}>Total Invested</span>
    </div>
    <div style={{ fontSize: '1.75rem', fontWeight: '700' }}>
      {formatCurrency(metrics.totalInvested)}
    </div>
    <div style={{ fontSize: '0.75rem', color: gainColor, fontWeight: '600' }}>
      {isPositiveGain ? '+' : ''}
      {formatCurrency(metrics.totalGain)} ({formatPercent(metrics.absoluteReturn)})
    </div>
  </div>
);
