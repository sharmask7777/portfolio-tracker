import React, { useState, useEffect, useRef } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  Briefcase,
  Calculator,
  Zap,
  BarChart2,
  Sliders,
  ArrowRight,
  ShieldAlert,
  Info,
} from 'lucide-react';
import { useSettings } from '../../contexts/SettingsContext';
import type { DragDecompositionDto } from '../../types/generated/DragDecompositionDto';

export interface StatsMetrics {
  totalInvested: number;
  totalValue: number;
  totalGain: number;
  absoluteReturn: number;
  xirr: number;
  postTaxTotalValue?: number;
  postTaxXirr?: number;
  realPostTaxXirr?: number | null;
  drags?: DragDecompositionDto | null;
  estimatedTax?: number;
  dayChange?: number;
  dayChangePercentage?: number;
}

export interface StatsGridProps {
  metrics: StatsMetrics;
  performanceMode: 'XIRR' | 'ABS';
  onNavigateToTax?: () => void;
}

const STATUTORY_TAX_SLABS = [
  { label: '0%', value: 0.0 },
  { label: '10%', value: 0.10 },
  { label: '15%', value: 0.15 },
  { label: '20%', value: 0.20 },
  { label: '30%', value: 0.30 },
  { label: '39%', value: 0.39 },
];

const INFLATION_PRESETS = [
  { label: 'RBI 4%', value: 0.04 },
  { label: 'Baseline 6%', value: 0.06 },
  { label: 'Conservative 8%', value: 0.08 },
];

export const StatsGrid: React.FC<StatsGridProps> = ({
  metrics,
  performanceMode,
  onNavigateToTax,
}) => {
  const {
    realityCheckMode,
    setRealityCheckMode,
    cpiInflationRate,
    setCpiInflationRate,
    marginalTaxBracket,
    setMarginalTaxBracket,
  } = useSettings();

  const [showAssumptions, setShowAssumptions] = useState(false);
  const [localCpiInput, setLocalCpiInput] = useState<string>(
    (cpiInflationRate * 100).toFixed(1)
  );
  const popoverRef = useRef<HTMLDivElement>(null);

  // Synchronize local input when context cpiInflationRate changes externally
  useEffect(() => {
    setLocalCpiInput((cpiInflationRate * 100).toFixed(1));
  }, [cpiInflationRate]);

  // Click outside listener for the assumptions popover
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setShowAssumptions(false);
      }
    };
    if (showAssumptions) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showAssumptions]);

  // Debounced input handler for custom CPI input
  const handleCpiInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setLocalCpiInput(val);
    const num = parseFloat(val);
    if (!isNaN(num) && num >= 0 && num <= 100) {
      setCpiInflationRate(num / 100);
    }
  };

  const isValidNumber = (val: unknown): val is number =>
    typeof val === 'number' && !isNaN(val);

  const formatCurrency = (val: unknown) => {
    if (!isValidNumber(val)) return '—';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(val);
  };

  const formatPercent = (val: unknown) => {
    if (!isValidNumber(val)) return '—';
    return (val * 100).toFixed(2) + '%';
  };

  const getReturnColor = (val: unknown) => {
    if (!isValidNumber(val)) return 'var(--text-primary)';
    return val > 0
      ? 'var(--success-color)'
      : val < 0
      ? 'var(--danger-color)'
      : 'var(--text-primary)';
  };

  const effectiveNetWorth = realityCheckMode
    ? metrics.postTaxTotalValue ?? metrics.totalValue - (metrics.estimatedTax ?? 0)
    : metrics.totalValue;

  const isPositiveGain = isValidNumber(metrics.totalGain) && metrics.totalGain > 0;
  const gainColor = getReturnColor(metrics.totalGain);

  // In Reality Check mode, performance is locked strictly to real post-tax XIRR
  const perfValue = realityCheckMode
    ? metrics.realPostTaxXirr ?? null
    : performanceMode === 'XIRR'
    ? metrics.xirr
    : metrics.absoluteReturn;

  const perfColor = getReturnColor(perfValue);

  // Compute drag components safely
  const drags = metrics.drags;
  const totalTaxDrag =
    isValidNumber(metrics.xirr) && isValidNumber(metrics.postTaxXirr)
      ? Math.max(0, metrics.xirr - metrics.postTaxXirr)
      : 0;

  const totalOverallDrag =
    isValidNumber(metrics.xirr) && isValidNumber(metrics.realPostTaxXirr)
      ? Math.max(0, metrics.xirr - metrics.realPostTaxXirr)
      : totalTaxDrag + (isValidNumber(metrics.postTaxXirr) && isValidNumber(metrics.realPostTaxXirr)
          ? Math.max(0, metrics.postTaxXirr - metrics.realPostTaxXirr)
          : 0);

  return (
    <>
      {/* Reality Check Master Switch Bar */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          padding: '0.75rem 1rem',
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: '12px',
          marginBottom: '1rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div
            style={{
              display: 'inline-flex',
              padding: '0.25rem',
              backgroundColor: 'var(--bg-secondary)',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
            }}
          >
            <button
              type="button"
              onClick={() => setRealityCheckMode(false)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                padding: '0.4rem 0.75rem',
                fontSize: '0.8125rem',
                fontWeight: realityCheckMode ? 500 : 700,
                color: realityCheckMode ? 'var(--text-secondary)' : 'var(--accent-color)',
                backgroundColor: realityCheckMode ? 'transparent' : 'var(--bg-card)',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                boxShadow: realityCheckMode ? 'none' : '0 1px 2px rgba(0,0,0,0.06)',
                transition: 'all 0.15s ease',
              }}
            >
              <BarChart2 size={15} />
              Broker View
            </button>
            <button
              type="button"
              onClick={() => setRealityCheckMode(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                padding: '0.4rem 0.75rem',
                fontSize: '0.8125rem',
                fontWeight: realityCheckMode ? 700 : 500,
                color: realityCheckMode ? '#f59e0b' : 'var(--text-secondary)',
                backgroundColor: realityCheckMode ? 'var(--bg-card)' : 'transparent',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                boxShadow: realityCheckMode ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              <Zap size={15} />
              Reality Check
            </button>
          </div>

          {realityCheckMode && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
                padding: '0.2rem 0.5rem',
                borderRadius: '6px',
                backgroundColor: 'rgba(245, 158, 11, 0.1)',
                color: '#d97706',
                fontSize: '0.75rem',
                fontWeight: 600,
              }}
            >
              <Info size={12} />
              After-Tax & Inflation Deflated
            </span>
          )}
        </div>

        {/* Assumptions Popover Trigger */}
        <div style={{ position: 'relative' }} ref={popoverRef}>
          <button
            type="button"
            onClick={() => setShowAssumptions(!showAssumptions)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.4rem 0.75rem',
              fontSize: '0.75rem',
              fontWeight: 600,
              color: 'var(--text-secondary)',
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              cursor: 'pointer',
            }}
          >
            <Sliders size={13} />
            Assumptions: CPI {(cpiInflationRate * 100).toFixed(0)}% · Slab{' '}
            {(marginalTaxBracket * 100).toFixed(0)}%
          </button>

          {showAssumptions && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 8px)',
                right: 0,
                zIndex: 50,
                width: '320px',
                padding: '1.25rem',
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                borderRadius: '12px',
                boxShadow: 'var(--card-shadow)',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.875rem', fontWeight: 700 }}>
                  Reality Check Assumptions
                </span>
                <button
                  type="button"
                  onClick={() => setShowAssumptions(false)}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: '1rem',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                  }}
                >
                  ✕
                </button>
              </div>

              {/* CPI Inflation Parameter */}
              <div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '0.75rem',
                    marginBottom: '0.4rem',
                    color: 'var(--text-secondary)',
                  }}
                >
                  <span>Annual CPI Inflation</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="20"
                      value={localCpiInput}
                      onChange={handleCpiInputChange}
                      style={{
                        width: '54px',
                        padding: '0.2rem 0.3rem',
                        fontSize: '0.75rem',
                        borderRadius: '4px',
                        border: '1px solid var(--border-color)',
                        backgroundColor: 'var(--input-bg)',
                        color: 'var(--text-primary)',
                        textAlign: 'right',
                      }}
                    />
                    <span>%</span>
                  </div>
                </div>
                <input
                  type="range"
                  min="0"
                  max="0.12"
                  step="0.005"
                  value={cpiInflationRate}
                  onChange={(e) => setCpiInflationRate(parseFloat(e.target.value))}
                  style={{ width: '100%', cursor: 'pointer' }}
                />
                <div style={{ display: 'flex', gap: '0.35rem', marginTop: '0.4rem' }}>
                  {INFLATION_PRESETS.map((p) => (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => setCpiInflationRate(p.value)}
                      style={{
                        flex: 1,
                        padding: '0.25rem 0.4rem',
                        fontSize: '0.6875rem',
                        borderRadius: '4px',
                        border: '1px solid var(--border-color)',
                        backgroundColor:
                          Math.abs(cpiInflationRate - p.value) < 0.001
                            ? 'var(--accent-light)'
                            : 'transparent',
                        color:
                          Math.abs(cpiInflationRate - p.value) < 0.001
                            ? 'var(--accent-color)'
                            : 'var(--text-secondary)',
                        fontWeight: Math.abs(cpiInflationRate - p.value) < 0.001 ? 700 : 500,
                        cursor: 'pointer',
                      }}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Marginal Tax Slab Parameter */}
              <div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '0.75rem',
                    marginBottom: '0.4rem',
                    color: 'var(--text-secondary)',
                  }}
                >
                  <span>Marginal Income Tax Slab</span>
                  <span style={{ fontWeight: 600 }}>{(marginalTaxBracket * 100).toFixed(0)}%</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.35rem' }}>
                  {STATUTORY_TAX_SLABS.map((s) => (
                    <button
                      key={s.value}
                      type="button"
                      onClick={() => setMarginalTaxBracket(s.value)}
                      style={{
                        padding: '0.35rem',
                        fontSize: '0.75rem',
                        borderRadius: '4px',
                        border: '1px solid var(--border-color)',
                        backgroundColor:
                          Math.abs(marginalTaxBracket - s.value) < 0.001
                            ? 'var(--accent-light)'
                            : 'transparent',
                        color:
                          Math.abs(marginalTaxBracket - s.value) < 0.001
                            ? 'var(--accent-color)'
                            : 'var(--text-secondary)',
                        fontWeight: Math.abs(marginalTaxBracket - s.value) < 0.001 ? 700 : 500,
                        cursor: 'pointer',
                      }}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="stats-grid">
        {/* Net Worth Card */}
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

        {/* Dual-readout grounding caption */}
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

      {/* Invested Capital Card */}
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

      {/* Performance Card */}
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

        {/* Dual-readout grounding caption in Reality Check mode */}
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

      {/* Full-Width Return Drag Teardown Banner */}
      {realityCheckMode && (
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
                <Zap size={18} color="#f59e0b" />
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
                View Harvesting Ticket <ArrowRight size={14} />
              </button>
            )}
          </div>

          {/* Stepped Waterfall Breakdown */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: '1rem',
              alignItems: 'stretch',
            }}
          >
            {/* Step 1: Gross Nominal XIRR */}
            <div
              style={{
                padding: '0.75rem',
                backgroundColor: 'var(--bg-secondary)',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
              }}
            >
              <div style={{ fontSize: '0.6875rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                1. Gross Nominal
              </div>
              <div style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                {formatPercent(drags?.nominalXirr ?? metrics.xirr)}
              </div>
              <div style={{ fontSize: '0.6875rem', color: 'var(--text-secondary)' }}>
                Pre-tax annualized IRR
              </div>
            </div>

            {/* Step 2: Debt Drag */}
            <div
              style={{
                padding: '0.75rem',
                backgroundColor: 'var(--bg-secondary)',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
              }}
            >
              <div style={{ fontSize: '0.6875rem', color: 'var(--danger-color)', fontWeight: 600 }}>
                2. Sec 50AA Debt Drag
              </div>
              <div style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--danger-color)' }}>
                -{formatPercent(drags?.debtDrag ?? 0)}
              </div>
              <div style={{ fontSize: '0.6875rem', color: 'var(--text-secondary)' }}>
                Slab rate ({(marginalTaxBracket * 100).toFixed(0)}%)
              </div>
            </div>

            {/* Step 3: Equity Drag */}
            <div
              style={{
                padding: '0.75rem',
                backgroundColor: 'var(--bg-secondary)',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
              }}
            >
              <div style={{ fontSize: '0.6875rem', color: 'var(--danger-color)', fontWeight: 600 }}>
                3. Sec 112A/111A Equity
              </div>
              <div style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--danger-color)' }}>
                -{formatPercent(drags?.equityDrag ?? 0)}
              </div>
              <div style={{ fontSize: '0.6875rem', color: 'var(--text-secondary)' }}>
                12.5% LTCG / 20% STCG
              </div>
            </div>

            {/* Step 4: Cess & Surcharge */}
            <div
              style={{
                padding: '0.75rem',
                backgroundColor: 'var(--bg-secondary)',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
              }}
            >
              <div style={{ fontSize: '0.6875rem', color: 'var(--danger-color)', fontWeight: 600 }}>
                4. Cess & Overheads
              </div>
              <div style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--danger-color)' }}>
                -{formatPercent(drags?.cessAndOtherDrag ?? 0)}
              </div>
              <div style={{ fontSize: '0.6875rem', color: 'var(--text-secondary)' }}>
                4% health & edu cess
              </div>
            </div>

            {/* Step 5: CPI Inflation Drag */}
            <div
              style={{
                padding: '0.75rem',
                backgroundColor: 'var(--bg-secondary)',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
              }}
            >
              <div style={{ fontSize: '0.6875rem', color: 'var(--danger-color)', fontWeight: 600 }}>
                5. CPI Inflation Drag
              </div>
              <div style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--danger-color)' }}>
                -{formatPercent(drags?.inflationDrag ?? 0)}
              </div>
              <div style={{ fontSize: '0.6875rem', color: 'var(--text-secondary)' }}>
                Purchasing power deflator
              </div>
            </div>

            {/* Step 6: Real Post-Tax XIRR */}
            <div
              style={{
                padding: '0.75rem',
                backgroundColor: 'rgba(4, 120, 87, 0.08)',
                borderRadius: '8px',
                border: '1px solid rgba(4, 120, 87, 0.3)',
              }}
            >
              <div style={{ fontSize: '0.6875rem', color: 'var(--success-color)', fontWeight: 700 }}>
                6. Real Purchasing XIRR
              </div>
              <div style={{ fontSize: '1.125rem', fontWeight: 800, color: 'var(--success-color)' }}>
                {formatPercent(drags?.realPostTaxXirr ?? metrics.realPostTaxXirr)}
              </div>
              <div style={{ fontSize: '0.6875rem', color: 'var(--text-secondary)' }}>
                True real compounding
              </div>
            </div>
          </div>

          {/* Benchmark Spread footer */}
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
              <ShieldAlert size={15} color="var(--accent-color)" />
              <span>
                <strong>Safe-Asset Benchmark Comparison:</strong> Real risk-free rate (~6.5% FD minus 30% slab & { (cpiInflationRate * 100).toFixed(0) }% CPI).
              </span>
            </div>
            <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
              Spread:{' '}
              <span
                style={{
                  color:
                    drags?.benchmarkSpread && drags.benchmarkSpread >= 0
                      ? 'var(--success-color)'
                      : 'var(--danger-color)',
                }}
              >
                {drags?.benchmarkSpread && drags.benchmarkSpread > 0 ? '+' : ''}
                {formatPercent(drags?.benchmarkSpread ?? 0)}
              </span>
            </div>
          </div>
        </div>
      )}
      </div>
    </>
  );
};
