import React from 'react';
import { Zap, ArrowRight, ShieldAlert } from 'lucide-react';
import type { DragDecompositionDto } from '../../types/generated/DragDecompositionDto';
import type { StatsMetrics } from './StatsGrid';
import { DragWaterfall } from './DragWaterfall';

interface RealityCheckDragBannerProps {
  metrics: StatsMetrics;
  drags: DragDecompositionDto | null | undefined;
  cpiInflationRate: number;
  marginalTaxBracket: number;
  formatCurrency?: ((val: unknown) => string) | undefined;
  formatPercent: (val: unknown) => string;
  onNavigateToTax?: (() => void) | undefined;
}

export const RealityCheckDragBanner: React.FC<RealityCheckDragBannerProps> = ({
  metrics,
  drags,
  cpiInflationRate,
  marginalTaxBracket,
  formatCurrency,
  formatPercent,
  onNavigateToTax,
}) => {
  const spread = drags?.benchmarkSpread ?? 0;
  const isPositiveSpread = drags?.benchmarkSpread && drags.benchmarkSpread > 0;
  const purchasingPowerValue = drags?.purchasingPowerValue;
  const purchasingPowerLoss = drags?.purchasingPowerLoss;

  return (
    <div
      className="card"
      style={{
        gridColumn: '1 / -1',
        padding: '1.5rem',
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border-color)',
        borderRadius: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.25rem',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '0.75rem',
          borderBottom: '1px solid var(--border-color)',
          paddingBottom: '0.75rem',
        }}
      >
        <div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: '1rem',
              fontWeight: 700,
            }}
          >
            <Zap size={18} color="#f59e0b" aria-hidden="true" />
            Return Drag Teardown: From Nominal Gain to Real Wealth
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            Sequential statutory layers eroding purchasing power under Indian taxation & inflation
          </div>
        </div>

        {onNavigateToTax && (
          <button
            type="button"
            onClick={onNavigateToTax}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0.45rem 0.85rem',
              fontSize: '0.8125rem',
              fontWeight: 600,
              color: '#ffffff',
              backgroundColor: 'var(--accent-color)',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              transition: 'opacity 0.15s ease',
            }}
          >
            View Harvesting Ticket <ArrowRight size={14} aria-hidden="true" />
          </button>
        )}
      </div>

      {typeof purchasingPowerValue === 'number' && Number.isFinite(purchasingPowerValue) && formatCurrency && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.75rem',
            padding: '0.85rem 1rem',
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: '10px',
          }}
        >
          <div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Real Post-Tax Purchasing Power (3Y Horizon)
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              {formatCurrency(purchasingPowerValue)}
            </div>
          </div>
          {typeof purchasingPowerLoss === 'number' && Number.isFinite(purchasingPowerLoss) && (
            <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--danger-color)' }}>
              -{formatCurrency(purchasingPowerLoss)} Tax + CPI Drag
            </div>
          )}
        </div>
      )}

      <DragWaterfall
        metrics={metrics}
        drags={drags}
        marginalTaxBracket={marginalTaxBracket}
        formatPercent={formatPercent}
      />

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.5rem',
          padding: '0.6rem 0.85rem',
          backgroundColor: 'var(--bg-secondary)',
          borderRadius: '8px',
          fontSize: '0.75rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <ShieldAlert size={15} color="var(--accent-color)" aria-hidden="true" />
          <span>
            <strong>Safe-Asset Benchmark Comparison:</strong> Real risk-free rate (~6.5% FD minus 30% slab & {(cpiInflationRate * 100).toFixed(0)}% CPI).
          </span>
        </div>
        <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
          Spread:{' '}
          <span style={{ color: isPositiveSpread ? 'var(--success-color)' : 'var(--danger-color)' }}>
            {isPositiveSpread ? '+' : ''}
            {formatPercent(spread)}
          </span>
        </div>
      </div>
    </div>
  );
};
