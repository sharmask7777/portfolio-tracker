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
  dayChange?: number;
  dayChangePercentage?: number;
}

interface StatsGridProps {
  metrics: StatsMetrics;
  performanceMode: 'XIRR' | 'ABS';
}

export const StatsGrid: React.FC<StatsGridProps> = ({ metrics, performanceMode }) => {
  const isValidNumber = (val: unknown): val is number => typeof val === 'number' && !isNaN(val);

  const formatCurrency = (val: unknown) => {
    if (!isValidNumber(val)) return 'N/A';
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val);
  };
  
  const formatPercent = (val: unknown) => {
    if (!isValidNumber(val)) return 'N/A';
    return (val * 100).toFixed(2) + '%';
  };

  const getReturnColor = (val: unknown) => {
    if (!isValidNumber(val)) return 'var(--text-primary)';
    return val > 0 ? 'var(--success-color)' : val < 0 ? 'var(--error-color)' : 'var(--text-primary)';
  };

  const isPositiveGain = isValidNumber(metrics.totalGain) && metrics.totalGain > 0;
  const gainColor = getReturnColor(metrics.totalGain);
  const perfValue = performanceMode === 'XIRR' ? metrics.xirr : metrics.absoluteReturn;
  const perfColor = getReturnColor(perfValue);

  return (
    <div className="stats-grid">
      {/* Net Worth Card */}
      <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--text-secondary)' }}>
          <Wallet size={18} />
          <span style={{ fontSize: '0.875rem', fontWeight: '500' }}>Current Net Worth</span>
        </div>
        <div style={{ fontSize: '1.75rem', fontWeight: '700' }}>
          {formatCurrency(metrics.totalValue)}
        </div>
        {isValidNumber(metrics.dayChange) && (
          <div style={{ fontSize: '0.875rem', color: getReturnColor(metrics.dayChange), fontWeight: '600' }}>
            {metrics.dayChange > 0 ? '+' : ''}{formatCurrency(metrics.dayChange)} {isValidNumber(metrics.dayChangePercentage) && `(${metrics.dayChangePercentage > 0 ? '+' : ''}${metrics.dayChangePercentage.toFixed(2)}%)`} Today
          </div>
        )}
        {isValidNumber(metrics.postTaxTotalValue) && (
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
        <div style={{ fontSize: '0.75rem', color: gainColor, fontWeight: '600' }}>
          {isPositiveGain ? '+' : ''}{formatCurrency(metrics.totalGain)} ({formatPercent(metrics.absoluteReturn)})
        </div>
      </div>

      {/* Performance Card */}
      <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--text-secondary)' }}>
          {isValidNumber(perfValue) && perfValue >= 0 ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
          <span style={{ fontSize: '0.875rem', fontWeight: '500' }}>
            Overall {performanceMode}
          </span>
        </div>
        <div style={{ fontSize: '1.75rem', fontWeight: '700', color: perfColor }}>
          {formatPercent(perfValue)}
        </div>
        {isValidNumber(metrics.dayChangePercentage) && (
          <div style={{ fontSize: '0.875rem', color: getReturnColor(metrics.dayChangePercentage), fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            {metrics.dayChangePercentage > 0 ? '▲' : metrics.dayChangePercentage < 0 ? '▼' : '–'}{' '}
            {metrics.dayChangePercentage > 0 ? '+' : ''}{metrics.dayChangePercentage.toFixed(2)}% Today
          </div>
        )}
        {performanceMode === 'XIRR' && isValidNumber(metrics.postTaxXirr) && (
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <Calculator size={12} />
            After-Tax XIRR: <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{formatPercent(metrics.postTaxXirr)}</span>
          </div>
        )}
        {performanceMode === 'ABS' && isValidNumber(metrics.estimatedTax) && (
           <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              Estimated Tax: {formatCurrency(metrics.estimatedTax)}
           </div>
        )}
      </div>
    </div>
  );
};
