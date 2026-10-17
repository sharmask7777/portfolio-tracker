import React, { useState, useMemo } from 'react';
import { Search, Layers, ArrowUpDown, ArrowUp, ArrowDown, Upload, X } from 'lucide-react';

export interface StockContribution {
  schemeName: string;
  value: number;
  weight: number;
}

export interface StockExposure {
  name: string;
  sector: string;
  absoluteValue: number;
  percentage: number;
  contributions: StockContribution[];
}

export interface IntersectionViewProps {
  exposures: StockExposure[];
  isLoading?: boolean;
  onUploadClick?: () => void;
}

type SortField = 'percentage' | 'absoluteValue' | 'name' | 'sector';
type SortDirection = 'asc' | 'desc';

export const IntersectionView: React.FC<IntersectionViewProps> = ({
  exposures,
  isLoading = false,
  onUploadClick,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSector, setSelectedSector] = useState('All Sectors');
  const [sortField, setSortField] = useState<SortField>('percentage');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const formatCurrency = (val: unknown) => {
    const num = typeof val === 'number' && Number.isFinite(val) ? val : 0;
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(num);
  };

  const formatPercent = (val: unknown) => {
    if (typeof val !== 'number' || !Number.isFinite(val)) return '0.00%';
    return `${(val * 100).toFixed(2)}%`;
  };

  const formatWeight = (val: unknown) => {
    if (typeof val !== 'number' || !Number.isFinite(val)) return '0.0%';
    return `${val.toFixed(1)}%`;
  };

  // Extract unique sectors for dropdown filter
  const sectorList = useMemo(() => {
    if (!exposures || !Array.isArray(exposures)) return ['All Sectors'];
    const sectors = new Set<string>();
    exposures.forEach((e) => {
      if (e.sector) sectors.add(e.sector);
    });
    return ['All Sectors', ...Array.from(sectors).sort()];
  }, [exposures]);

  // Filter and sort exposures
  const filteredExposures = useMemo(() => {
    if (!exposures || !Array.isArray(exposures)) return [];

    return exposures
      .filter((item) => {
        // Sector filter
        if (selectedSector !== 'All Sectors' && item.sector !== selectedSector) {
          return false;
        }

        // Search query filter (matches stock name, sector, or contributing fund schemeName)
        if (searchQuery.trim()) {
          const query = searchQuery.toLowerCase().trim();
          const matchesName = item.name.toLowerCase().includes(query);
          const matchesSector = item.sector.toLowerCase().includes(query);
          const matchesContribution = item.contributions?.some((c) =>
            c.schemeName.toLowerCase().includes(query)
          );
          return matchesName || matchesSector || matchesContribution;
        }

        return true;
      })
      .sort((a, b) => {
        let diff = 0;
        if (sortField === 'name') {
          diff = a.name.localeCompare(b.name);
        } else if (sortField === 'sector') {
          diff = a.sector.localeCompare(b.sector);
        } else if (sortField === 'percentage') {
          diff = (a.percentage || 0) - (b.percentage || 0);
        } else if (sortField === 'absoluteValue') {
          diff = (a.absoluteValue || 0) - (b.absoluteValue || 0);
        }
        return sortDirection === 'asc' ? diff : -diff;
      });
  }, [exposures, searchQuery, selectedSector, sortField, sortDirection]);

  // Aggregate metrics for summary bar
  const summaryMetrics = useMemo(() => {
    if (!filteredExposures || filteredExposures.length === 0) {
      return { totalValue: 0, multiFundCount: 0, count: 0 };
    }
    const totalValue = filteredExposures.reduce((acc, e) => acc + (e.absoluteValue || 0), 0);
    const multiFundCount = filteredExposures.filter((e) => (e.contributions?.length || 0) > 1).length;
    return {
      totalValue,
      multiFundCount,
      count: filteredExposures.length,
    };
  }, [filteredExposures]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection(field === 'name' || field === 'sector' ? 'asc' : 'desc');
    }
  };

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
              {[1, 2, 3, 4, 5].map((i) => (
                <tr key={i}>
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
        {/* Search & Sector Filters */}
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
            {sectorList.map((sec) => (
              <option key={sec} value={sec}>
                {sec}
              </option>
            ))}
          </select>
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
                color: 'var(--accent-color)',
                fontWeight: 500,
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
              {filteredExposures.map((item, idx) => {
                const isMultiFund = (item.contributions?.length || 0) > 1;

                return (
                  <tr key={`${item.name}-${idx}`}>
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
                              color: 'var(--accent-color)',
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
                        {(item.contributions || []).map((c, cIdx) => (
                          <span
                            key={cIdx}
                            className="contribution-tag"
                            title={`${formatCurrency(c.value)} (${formatWeight(c.weight)} allocation in ${c.schemeName})`}
                          >
                            {c.schemeName}{' '}
                            <strong style={{ color: 'var(--text-primary)', marginLeft: '2px' }}>
                              ({formatWeight(c.weight)})
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
