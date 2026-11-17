import React from 'react';
import { Wallet, Calculator } from 'lucide-react';
import type { StatsMetrics } from './StatsGrid';

interface NetWorthCardProps {
  metrics: StatsMetrics;
  realityCheckMode: boolean;
  effectiveNetWorth: number;
  formatCurrency: (val: unknown) => string;
  getReturnColor: (val: unknown) => string;
}

export const NetWorthCard: React.FC<NetWorthCardProps> = ({
  metrics,
  realityCheckMode,
  effectiveNetWorth,
  formatCurrency,
  getReturnColor,
}) => {
  const isValidNumber = (val: unknown): val is number => typeof val === 'number' && !isNaN(val);

  return (
    <div
      className="card"
      style={{
        padding: '1.5rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
        position: 'relative',
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
        <Wallet size={18} />
        <span style={{ fontSize: '0.875rem', fontWeight: '500' }}>
          {realityCheckMode ? 'Net Realizable Wealth' : 'Current Net Worth'}
        </span>
      </div>
      <div style={{ fontSize: '1.75rem', fontWeight: '700' }}>
        {formatCurrency(effectiveNetWorth)}
      </div>

      {realityCheckMode ? (
        <div
          style={{
            fontSize: '0.75rem',
            color: 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem',
          }}
        >
          <span>Gross: {formatCurrency(metrics.totalValue)}</span>
          <span>·</span>
          <span style={{ color: 'var(--danger-color)' }}>
            Est. Tax: -{formatCurrency(metrics.estimatedTax ?? 0)}
          </span>
        </div>
      ) : (
        isValidNumber(metrics.dayChange) && (
          <div
            style={{
              fontSize: '0.875rem',
              color: getReturnColor(metrics.dayChange),
              fontWeight: '600',
            }}
          >
            {metrics.dayChange > 0 ? '+' : ''}
            {formatCurrency(metrics.dayChange)}{' '}
            {isValidNumber(metrics.dayChangePercentage) &&
              `(${metrics.dayChangePercentage.toFixed(2)}%)`}{' '}
            Today
          </div>
        )
      )}

      {!realityCheckMode && isValidNumber(metrics.postTaxTotalValue) && (
        <div
          style={{
            fontSize: '0.75rem',
            color: 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.25rem',
          }}
        >
          <Calculator size={12} />
          After-Tax:{' '}
          <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>
            {formatCurrency(metrics.postTaxTotalValue)}
          </span>
        </div>
      )}
    </div>
  );
};
