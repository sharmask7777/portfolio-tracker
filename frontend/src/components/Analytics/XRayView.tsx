/**
 * @file XRayView.tsx
 * @module components/Analytics/XRayView
 * @description Master portfolio X-Ray analytical view with multi-level drilldown visualizations.
 *
 * Provides a segmented view switcher allowing the user to explore portfolio holdings via:
 * 1. Zoomable Treemap (aspect-ratio-optimized squarified partition with breadcrumb drilldown)
 * 2. Concentric Sunburst (radial arc geometry with Center Summary Hub and mobile tap-to-lock)
 * 3. Classic Grid (multi-card Recharts sector treemap, market cap bars, and asset pie chart)
 *
 * Integrates look-through stock exposures, arbitrage hedging isolation, and slide-over stock inspection.
 */

import React, { useState, useMemo } from 'react';
import type { XRayData } from './types';
import type { StockExposure } from './IntersectionView';
import { ExpenseAnalysis } from './ExpenseAnalysis';
import { XRayDashboard } from './XRayDashboard';
import { MultiLevelTreemap } from './MultiLevelTreemap';
import { SunburstChart } from './SunburstChart';
import { StockDetailDrawer } from './StockDetailDrawer';
import {
  buildPortfolioHierarchy,
  type HierarchyNode,
} from '../../utils/hierarchy-builder';

export type XRayViewMode = 'treemap' | 'sunburst' | 'classic';

export interface XRayViewProps {
  data: XRayData;
  exposures?: StockExposure[] | undefined;
  excludeArbitrage?: boolean | undefined;
  onToggleExcludeArbitrage?: ((exclude: boolean) => void) | undefined;
  onNavigateToIntersection?: ((stockName: string) => void) | undefined;
}

const VIEW_MODE_STORAGE_KEY = 'xray_view_mode';

export const XRayView: React.FC<XRayViewProps> = ({
  data,
  exposures,
  excludeArbitrage = false,
  onToggleExcludeArbitrage,
  onNavigateToIntersection,
}) => {
  // Initialize view mode with localStorage persistence
  const [viewMode, setViewMode] = useState<XRayViewMode>(() => {
    try {
      const stored = localStorage.getItem(VIEW_MODE_STORAGE_KEY);
      if (stored === 'treemap' || stored === 'sunburst' || stored === 'classic') {
        return stored;
      }
    } catch {
      // LocalStorage access may fail in restricted sandboxes
    }
    return 'treemap';
  });

  // Track active stock node for slide-over inspection drawer
  const [selectedStockNode, setSelectedStockNode] = useState<HierarchyNode | null>(null);

  const handleSelectViewMode = (mode: XRayViewMode) => {
    setViewMode(mode);
    try {
      localStorage.setItem(VIEW_MODE_STORAGE_KEY, mode);
    } catch {
      // Ignore storage errors
    }
  };

  // Rebuild hierarchical tree whenever data, exposures, or arbitrage toggle changes
  const rootHierarchyNode = useMemo(() => {
    if (!data || data.totalValue === 0) {
      return null;
    }
    return buildPortfolioHierarchy(data, exposures, {
      excludeArbitrage,
      isDarkMode: false,
    });
  }, [data, exposures, excludeArbitrage]);

  if (!data || !data.sectors) return <div className="loading-state">Loading X-Ray data...</div>;

  if (data.totalValue === 0) {
    return (
      <div className="empty-state">
        <h3>No X-Ray Data Available</h3>
        <p>Ensure your portfolio has active holdings with valid ISINs.</p>
      </div>
    );
  }

  return (
    <div className="xray-view animate-fade">
      {/* Expense Analysis Card */}
      <ExpenseAnalysis data={data} />

      {/* View Switcher and Arbitrage Controls Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '1rem',
          flexWrap: 'wrap',
          marginTop: '1.5rem',
          marginBottom: '1rem',
        }}
      >
        {/* Segmented Mode Control */}
        <div className="segmented-control" role="tablist" aria-label="X-Ray View Mode">
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === 'treemap'}
            className={viewMode === 'treemap' ? 'active' : ''}
            onClick={() => handleSelectViewMode('treemap')}
          >
            Zoomable Treemap
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === 'sunburst'}
            className={viewMode === 'sunburst' ? 'active' : ''}
            onClick={() => handleSelectViewMode('sunburst')}
          >
            Concentric Sunburst
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === 'classic'}
            className={viewMode === 'classic' ? 'active' : ''}
            onClick={() => handleSelectViewMode('classic')}
          >
            Classic Grid
          </button>
        </div>

        {/* Exclude Arbitrage Toggle (if callback provided) */}
        {onToggleExcludeArbitrage && (
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
              onChange={() => onToggleExcludeArbitrage(!excludeArbitrage)}
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
              }}
            >
              Exclude Arbitrage
            </span>
          </label>
        )}
      </div>

      {/* Visualization Canvas Body */}
      {viewMode === 'treemap' && rootHierarchyNode && (
        <div className="card" style={{ padding: '1rem', marginBottom: '2rem' }}>
          <MultiLevelTreemap
            rootNode={rootHierarchyNode}
            onSelectStock={setSelectedStockNode}
          />
        </div>
      )}

      {viewMode === 'sunburst' && rootHierarchyNode && (
        <div className="card" style={{ padding: '1rem', marginBottom: '2rem' }}>
          <SunburstChart
            rootNode={rootHierarchyNode}
            onSelectStock={setSelectedStockNode}
          />
        </div>
      )}

      {/* In Classic mode, render the standard XRayDashboard cards */}
      {viewMode === 'classic' && (
        <>
          <XRayDashboard data={data} title="Standard View" />
          {data.exArbitrage &&
            data.exArbitrage.assetAllocation.arbitrage &&
            data.exArbitrage.assetAllocation.arbitrage.value > 0 && (
              <XRayDashboard
                data={data.exArbitrage}
                title="Excluding Arbitrage (Black Box)"
              />
            )}
        </>
      )}

      {/* Slide-over Inspection Drawer for Stocks */}
      <StockDetailDrawer
        isOpen={selectedStockNode !== null}
        node={selectedStockNode}
        onClose={() => setSelectedStockNode(null)}
        onInspectInIntersection={(stockName) => {
          setSelectedStockNode(null);
          if (onNavigateToIntersection) {
            onNavigateToIntersection(stockName);
          }
        }}
      />
    </div>
  );
};

