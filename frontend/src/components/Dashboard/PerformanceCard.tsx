import React from 'react';
import { TrendingUp, TrendingDown, Calculator } from 'lucide-react';
import type { StatsMetrics } from './StatsGrid';

interface PerformanceCardProps {
  metrics: StatsMetrics;
  realityCheckMode: boolean;
  performanceMode: 'XIRR' | 'ABS';
  perfValue: number | null;
  perfColor: string;
  totalOverallDrag: number;
  formatPercent: (val: unknown) => string;
}

export const PerformanceCard: React.FC<PerformanceCardProps> = ({
  metrics,
  realityCheckMode,
  performanceMode,
  perfValue,
  perfColor,
  totalOverallDrag,
  formatPercent,
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
        {isValidNumber(perfValue) && perfValue >= 0 ? (
          <TrendingUp size={18} />
        ) : (
          <TrendingDown size={18} />
        )}
        <span style={{ fontSize: '0.875rem', fontWeight: '500' }}>
          {realityCheckMode ? 'Real Post-Tax XIRR' : `Overall ${performanceMode}`}
        </span>
      </div>
      <div style={{ fontSize: '1.75rem', fontWeight: '700', color: perfColor }}>
        {formatPercent(perfValue)}
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
          <span>Nominal: {formatPercent(metrics.xirr)}</span>
          <span>·</span>
          <span style={{ color: 'var(--danger-color)' }}>
            Total Drag: -{formatPercent(totalOverallDrag)}
          </span>
        </div>
      ) : (
        performanceMode === 'XIRR' &&
        isValidNumber(metrics.postTaxXirr) && (
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
            After-Tax XIRR:{' '}
            <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>
              {formatPercent(metrics.postTaxXirr)}
            </span>
          </div>
        )
      )}

      {realityCheckMode && (
        <div
          style={{
            fontSize: '0.6875rem',
            color: 'var(--text-secondary)',
            fontStyle: 'italic',
          }}
        >
          Reality Check operates on annual cash flows (XIRR) to calculate time-weighted purchasing power.
        </div>
      )}
    </div>
  );
};
