import React from 'react';
import type { DragDecompositionDto } from '../../types/generated/DragDecompositionDto';
import type { StatsMetrics } from './StatsGrid';

interface DragWaterfallProps {
  metrics: StatsMetrics;
  drags: DragDecompositionDto | null | undefined;
  marginalTaxBracket: number;
  formatPercent: (val: unknown) => string;
}

export const DragWaterfall: React.FC<DragWaterfallProps> = ({
  metrics,
  drags,
  marginalTaxBracket,
  formatPercent,
}) => (
  <div
    style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
      gap: '1rem',
      alignItems: 'stretch',
    }}
  >
    <div style={{ padding: '0.75rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
      <div style={{ fontSize: '0.6875rem', color: 'var(--text-secondary)', fontWeight: 600 }}>1. Gross Nominal</div>
      <div style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-primary)' }}>
        {formatPercent(drags?.nominalXirr ?? metrics.xirr)}
      </div>
      <div style={{ fontSize: '0.6875rem', color: 'var(--text-secondary)' }}>Pre-tax annualized IRR</div>
    </div>

    <div style={{ padding: '0.75rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
      <div style={{ fontSize: '0.6875rem', color: 'var(--danger-color)', fontWeight: 600 }}>2. Sec 50AA Debt Drag</div>
      <div style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--danger-color)' }}>
        -{formatPercent(drags?.debtDrag ?? 0)}
      </div>
      <div style={{ fontSize: '0.6875rem', color: 'var(--text-secondary)' }}>
        Slab rate ({(marginalTaxBracket * 100).toFixed(0)}%)
      </div>
    </div>

    <div style={{ padding: '0.75rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
      <div style={{ fontSize: '0.6875rem', color: 'var(--danger-color)', fontWeight: 600 }}>3. Sec 112A/111A Equity</div>
      <div style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--danger-color)' }}>
        -{formatPercent(drags?.equityDrag ?? 0)}
      </div>
      <div style={{ fontSize: '0.6875rem', color: 'var(--text-secondary)' }}>12.5% LTCG / 20% STCG</div>
    </div>

    <div style={{ padding: '0.75rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
      <div style={{ fontSize: '0.6875rem', color: 'var(--danger-color)', fontWeight: 600 }}>4. Cess & Overheads</div>
      <div style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--danger-color)' }}>
        -{formatPercent(drags?.cessAndOtherDrag ?? 0)}
      </div>
      <div style={{ fontSize: '0.6875rem', color: 'var(--text-secondary)' }}>4% health & edu cess</div>
    </div>

    <div style={{ padding: '0.75rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
      <div style={{ fontSize: '0.6875rem', color: 'var(--danger-color)', fontWeight: 600 }}>5. CPI Inflation Drag</div>
      <div style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--danger-color)' }}>
        -{formatPercent(drags?.inflationDrag ?? 0)}
      </div>
      <div style={{ fontSize: '0.6875rem', color: 'var(--text-secondary)' }}>Purchasing power deflator</div>
    </div>

    <div style={{ padding: '0.75rem', backgroundColor: 'rgba(4, 120, 87, 0.08)', borderRadius: '8px', border: '1px solid rgba(4, 120, 87, 0.3)' }}>
      <div style={{ fontSize: '0.6875rem', color: 'var(--success-color)', fontWeight: 700 }}>6. Real Purchasing XIRR</div>
      <div style={{ fontSize: '1.125rem', fontWeight: 800, color: 'var(--success-color)' }}>
        {formatPercent(drags?.realPostTaxXirr ?? metrics.realPostTaxXirr)}
      </div>
      <div style={{ fontSize: '0.6875rem', color: 'var(--text-secondary)' }}>True real compounding</div>
    </div>
  </div>
);
