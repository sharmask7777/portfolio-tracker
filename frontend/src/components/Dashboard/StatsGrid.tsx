import React, { useState, useEffect } from 'react';
import { useSettings } from '../../contexts/SettingsContext';
import type { DragDecompositionDto } from '../../types/generated/DragDecompositionDto';
import { RealityCheckAssumptionsPopover } from './RealityCheckAssumptionsPopover';
import { RealityCheckModeToggle } from './RealityCheckModeToggle';
import { RealityCheckDragBanner } from './RealityCheckDragBanner';
import { NetWorthCard } from './NetWorthCard';
import { InvestedCapitalCard } from './InvestedCapitalCard';
import { PerformanceCard } from './PerformanceCard';

export interface StatsMetrics {
  totalInvested: number;
  totalValue: number;
  totalGain: number;
  absoluteReturn: number;
  xirr: number;
  postTaxTotalValue?: number | undefined;
  postTaxXirr?: number | undefined;
  realPostTaxXirr?: number | null | undefined;
  drags?: DragDecompositionDto | null | undefined;
  estimatedTax?: number | undefined;
  dayChange?: number | undefined;
  dayChangePercentage?: number | undefined;
}

export interface StatsGridProps {
  metrics: StatsMetrics;
  performanceMode: 'XIRR' | 'ABS';
  onNavigateToTax?: (() => void) | undefined;
}

const isValidNumber = (val: unknown): val is number => typeof val === 'number' && !isNaN(val);

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
  return val > 0 ? 'var(--success-color)' : val < 0 ? 'var(--danger-color)' : 'var(--text-primary)';
};

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
  const [localCpiInput, setLocalCpiInput] = useState<string>((cpiInflationRate * 100).toFixed(1));

  useEffect(() => {
    setLocalCpiInput((cpiInflationRate * 100).toFixed(1));
  }, [cpiInflationRate]);

  const handleCpiInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setLocalCpiInput(val);
    const num = parseFloat(val);
    if (!isNaN(num) && num >= 0 && num <= 100) {
      setCpiInflationRate(num / 100);
    }
  };

  const effectiveNetWorth = realityCheckMode
    ? metrics.postTaxTotalValue ?? metrics.totalValue - (metrics.estimatedTax ?? 0)
    : metrics.totalValue;

  const isPositiveGain = isValidNumber(metrics.totalGain) && metrics.totalGain > 0;
  const gainColor = getReturnColor(metrics.totalGain);

  const perfValue = realityCheckMode
    ? metrics.realPostTaxXirr ?? null
    : performanceMode === 'XIRR'
    ? metrics.xirr
    : metrics.absoluteReturn;

  const perfColor = getReturnColor(perfValue);

  const totalTaxDrag =
    isValidNumber(metrics.xirr) && isValidNumber(metrics.postTaxXirr)
      ? Math.max(0, metrics.xirr - metrics.postTaxXirr)
      : 0;

  const totalOverallDrag =
    isValidNumber(metrics.xirr) && isValidNumber(metrics.realPostTaxXirr)
      ? Math.max(0, metrics.xirr - metrics.realPostTaxXirr)
      : totalTaxDrag +
        (isValidNumber(metrics.postTaxXirr) && isValidNumber(metrics.realPostTaxXirr)
          ? Math.max(0, metrics.postTaxXirr - metrics.realPostTaxXirr)
          : 0);

  return (
    <>
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
        <RealityCheckModeToggle
          realityCheckMode={realityCheckMode}
          setRealityCheckMode={setRealityCheckMode}
        />
        <RealityCheckAssumptionsPopover
          cpiInflationRate={cpiInflationRate}
          setCpiInflationRate={setCpiInflationRate}
          marginalTaxBracket={marginalTaxBracket}
          setMarginalTaxBracket={setMarginalTaxBracket}
          showAssumptions={showAssumptions}
          setShowAssumptions={setShowAssumptions}
          localCpiInput={localCpiInput}
          onCpiInputChange={handleCpiInputChange}
        />
      </div>

      <div className="stats-grid">
        <NetWorthCard
          metrics={metrics}
          realityCheckMode={realityCheckMode}
          effectiveNetWorth={effectiveNetWorth}
          formatCurrency={formatCurrency}
          getReturnColor={getReturnColor}
        />
        <InvestedCapitalCard
          metrics={metrics}
          formatCurrency={formatCurrency}
          formatPercent={formatPercent}
          gainColor={gainColor}
          isPositiveGain={isPositiveGain}
        />
        <PerformanceCard
          metrics={metrics}
          realityCheckMode={realityCheckMode}
          performanceMode={performanceMode}
          perfValue={perfValue}
          perfColor={perfColor}
          totalOverallDrag={totalOverallDrag}
          formatPercent={formatPercent}
        />
        {realityCheckMode && (
          <RealityCheckDragBanner
            metrics={metrics}
            drags={metrics.drags}
            cpiInflationRate={cpiInflationRate}
            marginalTaxBracket={marginalTaxBracket}
            formatPercent={formatPercent}
            onNavigateToTax={onNavigateToTax}
          />
        )}
      </div>
    </>
  );
};
