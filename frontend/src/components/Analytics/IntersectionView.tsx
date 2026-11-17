/**
 * @file IntersectionView.tsx
 * @module components/Analytics/IntersectionView
 * @description Provides portfolio look-through stock exposure analysis and cross-fund overlap tracking.
 *
 * Deconstructs active mutual fund scheme holdings to reveal aggregated look-through equity exposures
 * across the entire portfolio, surfacing company-level concentration, multi-fund overlaps, sector
 * weightings, and arbitrage hedging exclusions.
 */

import React, { useState, useMemo, useEffect } from 'react';
import { Layers, Upload } from 'lucide-react';
import { IntersectionControls } from './IntersectionControls';
import { IntersectionTable, type SortField, type SortDirection } from './IntersectionTable';

/**
 * Contribution of an individual mutual fund scheme to an underlying company's portfolio exposure.
 */
export interface StockContribution {
  /** Name of the mutual fund scheme holding the underlying company. */
  schemeName: string;
  /** Look-through rupee valuation of the stock held via this specific scheme. */
  value: number;
  /** Percentage portfolio weight of this stock within the specific scheme's asset portfolio. */
  weight: number;
}

/**
 * Aggregated look-through exposure in a single underlying publicly traded company.
 */
export interface StockExposure {
  /** Canonical name of the underlying company (e.g., 'HDFC Bank Ltd.'). */
  name: string;
  /** Macro industrial sector classification (e.g., 'Financial Services', 'Technology'). */
  sector: string;
  /** Aggregated monetary value held across all portfolio mutual funds and direct equities. */
  absoluteValue: number;
  /** Effective portfolio-level percentage weight (0.0 to 1.0). */
  percentage: number;
  /** Breakdown of individual mutual fund schemes contributing to this stock position. */
  contributions: StockContribution[];
}

/**
 * Properties for the {@link IntersectionView} component.
 */
export interface IntersectionViewProps {
  /** Array of aggregated look-through stock exposure objects. */
  exposures: StockExposure[];
  /** Whether portfolio look-through exposures are currently loading or recalculating. */
  isLoading?: boolean | undefined;
  /** Callback triggered when user clicks the upload CTA in an empty portfolio state. */
  onUploadClick?: (() => void) | undefined;
  /** Initial or controlled search query for filtering stock holdings. */
  initialSearchQuery?: string | undefined;
  /**
   * Whether arbitrage mutual funds are excluded from look-through exposure calculations.
   */
  excludeArbitrage?: boolean | undefined;
  /** Callback triggered when user toggles the arbitrage exclusion switch. */
  onToggleExcludeArbitrage?: ((exclude: boolean) => void) | undefined;
}

interface FilterSortOptions {
  searchQuery: string;
  selectedSector: string;
  sortField: SortField;
  sortDirection: SortDirection;
}

const LoadingSkeleton: React.FC = () => (
  <div className="intersection-view">
    <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
      <div style={{ height: '38px', flex: 1, minWidth: '220px', backgroundColor: 'var(--border-color)', borderRadius: '8px', opacity: 0.6 }} />
      <div style={{ height: '38px', width: '180px', backgroundColor: 'var(--border-color)', borderRadius: '8px', opacity: 0.6 }} />
    </div>
    <div className="table-container">
      <table className="data-table">
        <thead>
          <tr>
            <th>Stock Name</th>
            <th>Sector</th>
            <th>Total Exposure (%)</th>
            <th>Total Value</th>
            <th>Contributing Funds</th>
          </tr>
        </thead>
        <tbody>
          {[1, 2, 3, 4, 5].map((index) => (
            <tr key={index}>
              <td><div style={{ height: '16px', width: '140px', backgroundColor: 'var(--border-color)', borderRadius: '4px', opacity: 0.5 }} /></td>
              <td><div style={{ height: '16px', width: '100px', backgroundColor: 'var(--border-color)', borderRadius: '4px', opacity: 0.5 }} /></td>
              <td><div style={{ height: '16px', width: '60px', backgroundColor: 'var(--border-color)', borderRadius: '4px', opacity: 0.5 }} /></td>
              <td><div style={{ height: '16px', width: '80px', backgroundColor: 'var(--border-color)', borderRadius: '4px', opacity: 0.5 }} /></td>
              <td><div style={{ height: '16px', width: '220px', backgroundColor: 'var(--border-color)', borderRadius: '4px', opacity: 0.5 }} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

const EmptyExposures: React.FC<{ onUploadClick?: (() => void) | undefined }> = ({ onUploadClick }) => (
  <div className="intersection-view" style={{ padding: '3rem 1rem', textAlign: 'center' }}>
    <div
      style={{
        maxWidth: '520px',
        margin: '0 auto',
        padding: '2.5rem 2rem',
        backgroundColor: 'var(--bg-primary)',
        borderRadius: '12px',
        border: '1px solid var(--border-color)',
        boxShadow: 'var(--card-shadow)',
      }}
    >
      <div
        style={{
          display: 'inline-flex',
          padding: '1rem',
          borderRadius: '50%',
          backgroundColor: 'var(--accent-light)',
          color: 'var(--accent-color)',
          marginBottom: '1rem',
        }}
      >
        <Layers size={36} />
      </div>
      <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
        No Stock Exposures Identified
      </h3>
      <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '1.5rem' }}>
        We could not find active equity mutual funds or direct stocks in this scope. Upload your CAS statement or import equity holdings to inspect underlying company exposures and cross-fund overlap.
      </p>
      {onUploadClick && (
        <button
          onClick={onUploadClick}
          className="btn-primary"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.625rem 1.25rem',
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          <Upload size={16} />
          Upload CAS Statement
        </button>
      )}
    </div>
  </div>
);

const formatCurrency = (amount: unknown): string => {
  const numericAmount = typeof amount === 'number' && Number.isFinite(amount) ? amount : 0;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(numericAmount);
};

const formatPercent = (ratio: unknown): string => {
  if (typeof ratio !== 'number' || !Number.isFinite(ratio)) return '0.00%';
  return `${(ratio * 100).toFixed(2)}%`;
};

const formatWeight = (percentageValue: unknown): string => {
  if (typeof percentageValue !== 'number' || !Number.isFinite(percentageValue)) return '0.0%';
  return `${percentageValue.toFixed(1)}%`;
};

function matchesSearch(item: StockExposure, query: string): boolean {
  const matchesName = (item.name || '').toLowerCase().includes(query);
  const matchesSector = (item.sector || '').toLowerCase().includes(query);
  const matchesContribution = item.contributions?.some((contribution) =>
    (contribution.schemeName || '').toLowerCase().includes(query)
  );
  return matchesName || matchesSector || !!matchesContribution;
}

function compareExposures(
  first: StockExposure,
  second: StockExposure,
  field: SortField,
  direction: SortDirection
): number {
  let difference = 0;
  if (field === 'name') {
    difference = (first.name || '').localeCompare(second.name || '');
  } else if (field === 'sector') {
    difference = (first.sector || '').localeCompare(second.sector || '');
  } else if (field === 'percentage') {
    difference = (first.percentage || 0) - (second.percentage || 0);
  } else if (field === 'absoluteValue') {
    difference = (first.absoluteValue || 0) - (second.absoluteValue || 0);
  }
  return direction === 'asc' ? difference : -difference;
}

function useSectorList(exposures: StockExposure[]): string[] {
  return useMemo(() => {
    if (!exposures || !Array.isArray(exposures)) return ['All Sectors'];
    const uniqueSectors = new Set<string>();
    exposures.forEach((exposure) => {
      if (exposure.sector) uniqueSectors.add(exposure.sector);
    });
    return ['All Sectors', ...Array.from(uniqueSectors).sort()];
  }, [exposures]);
}

function useFilteredExposures(
  exposures: StockExposure[],
  options: FilterSortOptions
): StockExposure[] {
  const { searchQuery, selectedSector, sortField, sortDirection } = options;
  return useMemo(() => {
    if (!exposures || !Array.isArray(exposures)) return [];

    return exposures
      .filter((item) => {
        if (selectedSector !== 'All Sectors' && item.sector !== selectedSector) return false;
        if (searchQuery.trim()) {
          return matchesSearch(item, searchQuery.toLowerCase().trim());
        }
        return true;
      })
      .sort((first, second) => compareExposures(first, second, sortField, sortDirection));
  }, [exposures, searchQuery, selectedSector, sortField, sortDirection]);
}

export const IntersectionView: React.FC<IntersectionViewProps> = ({
  exposures,
  isLoading = false,
  onUploadClick,
  initialSearchQuery = '',
  excludeArbitrage = false,
  onToggleExcludeArbitrage,
}) => {
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery);
  const [selectedSector, setSelectedSector] = useState('All Sectors');
  const [sortField, setSortField] = useState<SortField>('percentage');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  useEffect(() => {
    setSearchQuery(initialSearchQuery);
  }, [initialSearchQuery]);

  const sectorList = useSectorList(exposures);
  const filteredExposures = useFilteredExposures(exposures, {
    searchQuery,
    selectedSector,
    sortField,
    sortDirection,
  });

  const summaryMetrics = useMemo(() => {
    if (!filteredExposures || filteredExposures.length === 0) {
      return { totalValue: 0, multiFundCount: 0, count: 0 };
    }
    const totalValue = filteredExposures.reduce(
      (accumulated, exposure) => accumulated + (exposure.absoluteValue || 0),
      0
    );
    const multiFundCount = filteredExposures.filter(
      (exposure) => (exposure.contributions?.length || 0) > 1
    ).length;
    return { totalValue, multiFundCount, count: filteredExposures.length };
  }, [filteredExposures]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prevDirection) => (prevDirection === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection(field === 'name' || field === 'sector' ? 'asc' : 'desc');
    }
  };

  if (isLoading) return <LoadingSkeleton />;
  if (!exposures || exposures.length === 0) return <EmptyExposures onUploadClick={onUploadClick} />;

  return (
    <div className="intersection-view">
      <IntersectionControls
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        selectedSector={selectedSector}
        onSectorChange={setSelectedSector}
        sectorList={sectorList}
        excludeArbitrage={excludeArbitrage}
        onToggleExcludeArbitrage={onToggleExcludeArbitrage}
        summaryMetrics={summaryMetrics}
        formatCurrency={formatCurrency}
      />
      <IntersectionTable
        filteredExposures={filteredExposures}
        sortField={sortField}
        sortDirection={sortDirection}
        onSort={handleSort}
        formatCurrency={formatCurrency}
        formatPercent={formatPercent}
        formatWeight={formatWeight}
      />
    </div>
  );
};
