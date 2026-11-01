/**
 * @file IntersectionView.tsx
 * @module components/Analytics/IntersectionView
 * @description Provides portfolio look-through stock exposure analysis and cross-fund overlap tracking.
 *
 * Deconstructs active mutual fund scheme holdings to reveal aggregated look-through equity exposures
 * across the entire portfolio, surfacing company-level concentration, multi-fund overlaps, sector
 * weightings, and arbitrage hedging exclusions.
 */

import React, { useState, useMemo } from 'react';
import { Search, Layers, ArrowUpDown, ArrowUp, ArrowDown, Upload, X } from 'lucide-react';

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
  isLoading?: boolean;
  /** Callback triggered when user clicks the upload CTA in an empty portfolio state. */
  onUploadClick?: () => void;
  /**
   * Whether arbitrage mutual funds are excluded from look-through exposure calculations.
   *
   * Arbitrage funds hold equity shares hedged with equal short futures positions (cash-futures
   * spread) to deliver risk-free debt-like yields while retaining equity tax treatment.
   * Excluding them prevents distortion of directional equity allocation percentages.
   */
  excludeArbitrage?: boolean;
  /** Callback triggered when user toggles the arbitrage exclusion switch. */
  onToggleExcludeArbitrage?: (exclude: boolean) => void;
}

/** Sortable column field names for the stock exposure table. */
type SortField = 'percentage' | 'absoluteValue' | 'name' | 'sector';

/** Sorting order direction. */
type SortDirection = 'asc' | 'desc';

/**
 * Renders the Portfolio Look-Through Stock Intersection & Overlap Analysis view.
 *
 * ### Look-Through Stock Exposure Formulation
 * Mutual fund schemes publish monthly portfolio disclosures detailing individual company holdings.
 * By multiplying an investor's scheme valuation by each fund's published company weight, the portfolio
 * engine derives true effective exposure to individual companies:
 *
 * $$ \text{Effective Stock Value} = \sum_{f \in \text{Funds}} \Big( \text{Valuation}_f \times \text{Weight}_{f,\text{Stock}} \Big) $$
 *
 * ### Multi-Fund Overlap Detection
 * When an underlying stock is held across two or more schemes, a prominent badge is rendered
 * (e.g., `"2 Funds Overlap"`). This alerts the investor to unintended concentration risk where
 * multiple funds simultaneously bet on identical corporate names.
 *
 * ### Arbitrage Exclusion Denominator Adjustment
 * Arbitrage funds maintain ~65-70% gross equity exposure solely to qualify for Section 112A equity
 * capital gains taxation, but hedge 100% of directional market risk with stock futures.
 * When `excludeArbitrage` is enabled, the backend eliminates hedged arbitrage holdings from both
 * company contributions and the total portfolio denominator, reflecting pure directional equity risk.
 */
export const IntersectionView: React.FC<IntersectionViewProps> = ({
  exposures,
  isLoading = false,
  onUploadClick,
  excludeArbitrage = false,
  onToggleExcludeArbitrage,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSector, setSelectedSector] = useState('All Sectors');
  const [sortField, setSortField] = useState<SortField>('percentage');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  /**
   * Formats a monetary value to Indian Rupee currency format (e.g. ₹1,50,000).
   */
  const formatCurrency = (amount: unknown): string => {
    const numericAmount = typeof amount === 'number' && Number.isFinite(amount) ? amount : 0;
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(numericAmount);
  };

  /**
   * Formats a decimal ratio into a percentage display string (e.g. 0.1523 -> "15.23%").
   */
  const formatPercent = (ratio: unknown): string => {
    if (typeof ratio !== 'number' || !Number.isFinite(ratio)) return '0.00%';
    return `${(ratio * 100).toFixed(2)}%`;
  };

  /**
   * Formats a fund-level percentage weight (e.g. 8.2 -> "8.2%").
   */
  const formatWeight = (percentageValue: unknown): string => {
    if (typeof percentageValue !== 'number' || !Number.isFinite(percentageValue)) return '0.0%';
    return `${percentageValue.toFixed(1)}%`;
  };

  // Extract unique industrial sectors for the filter dropdown
  const sectorList = useMemo(() => {
    if (!exposures || !Array.isArray(exposures)) return ['All Sectors'];
    const uniqueSectors = new Set<string>();
    exposures.forEach((exposure) => {
      if (exposure.sector) uniqueSectors.add(exposure.sector);
    });
    return ['All Sectors', ...Array.from(uniqueSectors).sort()];
  }, [exposures]);

  // Filter and sort exposures based on user selection, search query, and sorting column
  const filteredExposures = useMemo(() => {
    if (!exposures || !Array.isArray(exposures)) return [];

    return exposures
      .filter((item) => {
        // Industrial Sector filter
        if (selectedSector !== 'All Sectors' && item.sector !== selectedSector) {
          return false;
        }

        // Full-text search matching stock name, sector, or constituent contributing fund scheme name
        if (searchQuery.trim()) {
          const query = searchQuery.toLowerCase().trim();
          const matchesName = (item.name || '').toLowerCase().includes(query);
          const matchesSector = (item.sector || '').toLowerCase().includes(query);
          const matchesContribution = item.contributions?.some((contribution) =>
            (contribution.schemeName || '').toLowerCase().includes(query)
          );
          return matchesName || matchesSector || matchesContribution;
        }

        return true;
      })
      .sort((first, second) => {
        let difference = 0;
        if (sortField === 'name') {
          difference = (first.name || '').localeCompare(second.name || '');
        } else if (sortField === 'sector') {
          difference = (first.sector || '').localeCompare(second.sector || '');
        } else if (sortField === 'percentage') {
          difference = (first.percentage || 0) - (second.percentage || 0);
        } else if (sortField === 'absoluteValue') {
          difference = (first.absoluteValue || 0) - (second.absoluteValue || 0);
        }
        return sortDirection === 'asc' ? difference : -difference;
      });
  }, [exposures, searchQuery, selectedSector, sortField, sortDirection]);

  // Aggregate summary metrics across currently filtered exposures
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
    return {
      totalValue,
      multiFundCount,
      count: filteredExposures.length,
    };
  }, [filteredExposures]);

  /**
   * Toggles column sorting direction or changes the active sorting column.
   */
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prevDirection) => (prevDirection === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      // Alphabetical columns default to ascending; numerical values default to descending
      setSortDirection(field === 'name' || field === 'sector' ? 'asc' : 'desc');
    }
  };

  /**
   * Renders sort direction arrows for the table header cells.
   */
  const renderSortIndicator = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown size={14} style={{ opacity: 0.4, marginLeft: '4px' }} />;
    }
    return sortDirection === 'asc' ? (
      <ArrowUp size={14} style={{ color: 'var(--accent-color)', marginLeft: '4px' }} />
    ) : (
      <ArrowDown size={14} style={{ color: 'var(--accent-color)', marginLeft: '4px' }} />
    );
  };

  // Loading Skeleton State
  if (isLoading) {
    return (
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
  }

  // Empty State: No Exposures Available in Portfolio
  if (!exposures || exposures.length === 0) {
    return (
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
  }

  return (
    <div className="intersection-view">
      {/* Controls & Metrics Header */}
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
        {/* Search, Sector, and Arbitrage Exclusion Filters */}
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', flex: 1, minWidth: '280px' }}>
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
              onChange={(e) => setSearchQuery(e.target.value)}
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
                onClick={() => setSearchQuery('')}
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

          <select
            value={selectedSector}
            onChange={(e) => setSelectedSector(e.target.value)}
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

          {/* Arbitrage Fund Exclusion Toggle */}
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
        </div>

        {/* Aggregate Summary Badges */}
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
      </div>

      {/* Filtered Empty State */}
      {filteredExposures.length === 0 ? (
        <div
          style={{
            padding: '2.5rem',
            textAlign: 'center',
            backgroundColor: 'var(--bg-primary)',
            borderRadius: '8px',
            border: '1px solid var(--border-color)',
          }}
        >
          <p style={{ color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
            No stocks matched your search or sector filter criteria.
          </p>
          <button
            onClick={() => {
              setSearchQuery('');
              setSelectedSector('All Sectors');
            }}
            className="btn-secondary"
            style={{ fontSize: '0.8125rem', cursor: 'pointer', padding: '0.4rem 0.8rem' }}
          >
            Reset Filters
          </button>
        </div>
      ) : (
        /* Exposure & Overlap Table */
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th
                  onClick={() => handleSort('name')}
                  style={{ cursor: 'pointer', userSelect: 'none' }}
                >
                  <div style={{ display: 'inline-flex', alignItems: 'center' }}>
                    Stock Name {renderSortIndicator('name')}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('sector')}
                  style={{ cursor: 'pointer', userSelect: 'none' }}
                >
                  <div style={{ display: 'inline-flex', alignItems: 'center' }}>
                    Sector {renderSortIndicator('sector')}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('percentage')}
                  style={{ cursor: 'pointer', userSelect: 'none' }}
                >
                  <div style={{ display: 'inline-flex', alignItems: 'center' }}>
                    Total Exposure (%) {renderSortIndicator('percentage')}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('absoluteValue')}
                  style={{ cursor: 'pointer', userSelect: 'none' }}
                >
                  <div style={{ display: 'inline-flex', alignItems: 'center' }}>
                    Total Value {renderSortIndicator('absoluteValue')}
                  </div>
                </th>
                <th>Contributing Funds & Allocation</th>
              </tr>
            </thead>
            <tbody>
              {filteredExposures.map((item, index) => {
                const isMultiFund = (item.contributions?.length || 0) > 1;

                return (
                  <tr key={`${item.name}-${index}`}>
                    <td style={{ fontWeight: 600 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span>{item.name}</span>
                        {isMultiFund && (
                          <span
                            style={{
                              fontSize: '0.6875rem',
                              padding: '0.15rem 0.45rem',
                              borderRadius: '4px',
                              backgroundColor: 'rgba(37, 99, 235, 0.1)',
                              color: 'var(--text-primary)',
                              fontWeight: 600,
                              whiteSpace: 'nowrap',
                            }}
                            title={`Present across ${item.contributions.length} mutual funds / portfolios`}
                          >
                            {item.contributions.length} Funds Overlap
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      <span
                        style={{
                          fontSize: '0.75rem',
                          padding: '0.2rem 0.5rem',
                          borderRadius: '4px',
                          backgroundColor: 'var(--bg-secondary)',
                          color: 'var(--text-secondary)',
                          border: '1px solid var(--border-color)',
                        }}
                      >
                        {item.sector || 'Other'}
                      </span>
                    </td>
                    <td style={{ fontWeight: 600, color: 'var(--accent-color)' }}>
                      {formatPercent(item.percentage)}
                    </td>
                    <td style={{ fontWeight: 500 }}>{formatCurrency(item.absoluteValue)}</td>
                    <td>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                        {(item.contributions || []).map((contribution, contributionIndex) => (
                          <span
                            key={contributionIndex}
                            className="contribution-tag"
                            title={`${formatCurrency(contribution.value)} (${formatWeight(contribution.weight)} allocation in ${contribution.schemeName})`}
                          >
                            {contribution.schemeName}{' '}
                            <strong style={{ color: 'var(--text-primary)', marginLeft: '2px' }}>
                              ({formatWeight(contribution.weight)})
                            </strong>
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
