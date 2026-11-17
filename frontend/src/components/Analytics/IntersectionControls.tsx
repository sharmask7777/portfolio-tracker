/**
 * @file IntersectionControls.tsx
 * @module components/Analytics/IntersectionControls
 * @description Filter, search, and summary badges for IntersectionView.
 */

import React from 'react';
import { Search, X } from 'lucide-react';

interface SummaryMetrics {
  totalValue: number;
  multiFundCount: number;
  count: number;
}

interface IntersectionControlsProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  selectedSector: string;
  onSectorChange: (s: string) => void;
  sectorList: string[];
  excludeArbitrage: boolean;
  onToggleExcludeArbitrage?: ((exclude: boolean) => void) | undefined;
  summaryMetrics: SummaryMetrics;
  formatCurrency: (amount: unknown) => string;
}

const SummaryBadges: React.FC<{
  summaryMetrics: SummaryMetrics;
  formatCurrency: (amount: unknown) => string;
}> = ({ summaryMetrics, formatCurrency }) => (
  <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
    <div
      style={{
        padding: '0.35rem 0.75rem',
        borderRadius: '6px',
        backgroundColor: 'var(--bg-primary)',
        border: '1px solid var(--border-color)',
        fontSize: '0.8125rem',
        color: 'var(--text-secondary)',
      }}
    >
      Identified: <strong style={{ color: 'var(--text-primary)' }}>{summaryMetrics.count} Companies</strong>
    </div>
    <div
      style={{
        padding: '0.35rem 0.75rem',
        borderRadius: '6px',
        backgroundColor: 'var(--bg-primary)',
        border: '1px solid var(--border-color)',
        fontSize: '0.8125rem',
        color: 'var(--text-secondary)',
      }}
    >
      Total Value: <strong style={{ color: 'var(--text-primary)' }}>{formatCurrency(summaryMetrics.totalValue)}</strong>
    </div>
    {summaryMetrics.multiFundCount > 0 && (
      <div
        style={{
          padding: '0.35rem 0.75rem',
          borderRadius: '6px',
          backgroundColor: 'rgba(37, 99, 235, 0.1)',
          border: '1px solid rgba(37, 99, 235, 0.2)',
          fontSize: '0.8125rem',
          color: 'var(--text-primary)',
          fontWeight: 600,
        }}
      >
        {summaryMetrics.multiFundCount} Common in Multiple Funds
      </div>
    )}
  </div>
);

const SearchBar: React.FC<{
  searchQuery: string;
  onSearchChange: (q: string) => void;
}> = ({ searchQuery, onSearchChange }) => (
  <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
    <Search
      size={16}
      style={{
        position: 'absolute',
        left: '12px',
        top: '50%',
        transform: 'translateY(-50%)',
        color: 'var(--text-secondary)',
      }}
    />
    <input
      type="text"
      placeholder="Search stocks, sectors, or funds..."
      value={searchQuery}
      onChange={(e) => onSearchChange(e.target.value)}
      style={{
        width: '100%',
        padding: '0.5rem 2rem 0.5rem 2.25rem',
        borderRadius: '8px',
        border: '1px solid var(--border-color)',
        backgroundColor: 'var(--bg-primary)',
        color: 'var(--text-primary)',
        fontSize: '0.875rem',
      }}
    />
    {searchQuery && (
      <button
        onClick={() => onSearchChange('')}
        aria-label="Clear search"
        style={{
          position: 'absolute',
          right: '10px',
          top: '50%',
          transform: 'translateY(-50%)',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--text-secondary)',
          padding: '2px',
        }}
      >
        <X size={14} />
      </button>
    )}
  </div>
);

const ArbitrageToggle: React.FC<{
  excludeArbitrage: boolean;
  onToggleExcludeArbitrage: ((exclude: boolean) => void) | undefined;
}> = ({ excludeArbitrage, onToggleExcludeArbitrage }) => (
  <label
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '0.5rem',
      cursor: 'pointer',
      userSelect: 'none',
      padding: '0.45rem 0.75rem',
      borderRadius: '8px',
      border: `1px solid ${excludeArbitrage ? 'var(--accent-color)' : 'var(--border-color)'}`,
      backgroundColor: excludeArbitrage ? 'rgba(37, 99, 235, 0.08)' : 'var(--bg-primary)',
      transition: 'all 0.15s ease-in-out',
    }}
  >
    <input
      type="checkbox"
      checked={excludeArbitrage}
      onChange={() => onToggleExcludeArbitrage?.(!excludeArbitrage)}
      aria-label="Exclude Arbitrage Funds"
      style={{
        cursor: 'pointer',
        accentColor: 'var(--accent-color)',
        width: '16px',
        height: '16px',
      }}
    />
    <span
      style={{
        fontSize: '0.8125rem',
        fontWeight: 500,
        color: 'var(--text-primary)',
        whiteSpace: 'nowrap',
      }}
    >
      Exclude Arbitrage Funds
    </span>
  </label>
);

export const IntersectionControls: React.FC<IntersectionControlsProps> = ({
  searchQuery,
  onSearchChange,
  selectedSector,
  onSectorChange,
  sectorList,
  excludeArbitrage,
  onToggleExcludeArbitrage,
  summaryMetrics,
  formatCurrency,
}) => {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '1rem',
        flexWrap: 'wrap',
        marginBottom: '1.25rem',
      }}
    >
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', flex: 1, minWidth: '280px' }}>
        <SearchBar searchQuery={searchQuery} onSearchChange={onSearchChange} />

        <select
          value={selectedSector}
          onChange={(e) => onSectorChange(e.target.value)}
          style={{
            padding: '0.5rem 1rem',
            borderRadius: '8px',
            border: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-primary)',
            color: 'var(--text-primary)',
            fontSize: '0.875rem',
            cursor: 'pointer',
          }}
        >
          {sectorList.map((sector) => (
            <option key={sector} value={sector}>
              {sector}
            </option>
          ))}
        </select>

        <ArbitrageToggle
          excludeArbitrage={excludeArbitrage}
          onToggleExcludeArbitrage={onToggleExcludeArbitrage}
        />
      </div>

      <SummaryBadges summaryMetrics={summaryMetrics} formatCurrency={formatCurrency} />
    </div>
  );
};
