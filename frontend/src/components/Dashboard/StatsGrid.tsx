import React from 'react';
import { TrendingUp, TrendingDown, Wallet, Briefcase, Calculator } from 'lucide-react';

interface StatsMetrics {
  totalInvested: number;
  totalValue: number;
  totalGain: number;
  absoluteReturn: number;
  xirr: number;
  postTaxTotalValue?: number;
  postTaxXirr?: number;
  estimatedTax?: number;
}

interface StatsGridProps {
  metrics: StatsMetrics;
  performanceMode: 'XIRR' | 'ABS';
}

export const StatsGrid: React.FC<StatsGridProps> = ({ metrics, performanceMode }) => {
  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val);
  
  const formatPercent = (val: number) => (val * 100).toFixed(2) + '%';

  const isPositive = metrics.totalGain >= 0;

  return (
    <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
      {/* Net Worth Card */}
      <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--text-secondary)' }}>
          <Wallet size={18} />
          <span style={{ fontSize: '0.875rem', fontWeight: '500' }}>Current Net Worth</span>
        </div>
        <div style={{ fontSize: '1.75rem', fontWeight: '700' }}>
          {formatCurrency(metrics.totalValue)}
        </div>
        {metrics.postTaxTotalValue !== undefined && (
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <Calculator size={12} />
            After-Tax: <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{formatCurrency(metrics.postTaxTotalValue)}</span>
          </div>
        )}
      </div>

      {/* Invested Card */}
      <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--text-secondary)' }}>
          <Briefcase size={18} />
          <span style={{ fontSize: '0.875rem', fontWeight: '500' }}>Total Invested</span>
        </div>
        <div style={{ fontSize: '1.75rem', fontWeight: '700' }}>
          {formatCurrency(metrics.totalInvested)}
        </div>
        <div style={{ fontSize: '0.75rem', color: isPositive ? 'var(--success-color)' : 'var(--error-color)', fontWeight: '600' }}>
          {isPositive ? '+' : ''}{formatCurrency(metrics.totalGain)} ({formatPercent(metrics.absoluteReturn)})
        </div>
      </div>

      {/* Performance Card */}
      <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--text-secondary)' }}>
          {isPositive ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
          <span style={{ fontSize: '0.875rem', fontWeight: '500' }}>
            Overall {performanceMode}
          </span>
        </div>
        <div style={{ fontSize: '1.75rem', fontWeight: '700', color: isPositive ? 'var(--success-color)' : 'var(--error-color)' }}>
          {formatPercent(performanceMode === 'XIRR' ? metrics.xirr : metrics.absoluteReturn)}
        </div>
        {performanceMode === 'XIRR' && metrics.postTaxXirr !== undefined && (
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <Calculator size={12} />
            After-Tax XIRR: <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{formatPercent(metrics.postTaxXirr)}</span>
          </div>
        )}
        {performanceMode === 'ABS' && metrics.postTaxTotalValue !== undefined && (
           <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              Estimated Tax: {formatCurrency(metrics.estimatedTax || 0)}
           </div>
        )}
      </div>
    </div>
  );
};
