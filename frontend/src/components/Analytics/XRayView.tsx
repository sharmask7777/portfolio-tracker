/**
 * @file XRayView.tsx
 * @module components/Analytics/XRayView
 * @description Advanced multi-view portfolio look-through X-Ray canvas.
 */

import React, { useState, useMemo } from 'react';
import type { XRayData, StockExposure, HierarchyNode } from '../../utils/hierarchy-builder';
import { buildPortfolioHierarchy } from '../../utils/hierarchy-builder';
import { ExpenseAnalysis } from './ExpenseAnalysis';
import { MultiLevelTreemap } from './MultiLevelTreemap';
import { SunburstChart } from './SunburstChart';
import { XRayDashboard } from './XRayDashboard';
import { StockDetailDrawer } from './StockDetailDrawer';
import { XRayViewModeControls, type XRayViewMode } from './XRayViewModeControls';

interface XRayViewProps {
  data: XRayData | null;
  exposures?: StockExposure[];
  excludeArbitrage?: boolean;
  onToggleExcludeArbitrage?: (exclude: boolean) => void;
  onNavigateToIntersection?: (stockName?: string) => void;
}

const VIEW_MODE_STORAGE_KEY = 'xray_view_mode';

function loadStoredViewMode(): XRayViewMode {
  try {
    const stored = localStorage.getItem(VIEW_MODE_STORAGE_KEY);
    if (stored === 'treemap' || stored === 'sunburst' || stored === 'classic') {
      return stored;
    }
  } catch {
    // Ignore sandbox errors
  }
  return 'treemap';
}

interface CanvasBodyProps {
  viewMode: XRayViewMode;
  rootHierarchyNode: HierarchyNode | null;
  data: XRayData;
  onSelectStock: (node: HierarchyNode) => void;
}

const XRayCanvasBody: React.FC<CanvasBodyProps> = ({
  viewMode,
  rootHierarchyNode,
  data,
  onSelectStock,
}) => {
  if (viewMode === 'treemap' && rootHierarchyNode) {
    return (
      <div className="card" style={{ padding: '1rem', marginBottom: '2rem' }}>
        <MultiLevelTreemap rootNode={rootHierarchyNode} onSelectStock={onSelectStock} />
      </div>
    );
  }

  if (viewMode === 'sunburst' && rootHierarchyNode) {
    return (
      <div className="card" style={{ padding: '1rem', marginBottom: '2rem' }}>
        <SunburstChart rootNode={rootHierarchyNode} onSelectStock={onSelectStock} />
      </div>
    );
  }

  if (viewMode === 'classic') {
    const arb = data.exArbitrage?.assetAllocation.arbitrage;
    return (
      <>
        <XRayDashboard data={data} title="Standard View" />
        {data.exArbitrage && arb && arb.value > 0 && (
          <XRayDashboard data={data.exArbitrage} title="Excluding Arbitrage (Black Box)" />
        )}
      </>
    );
  }

  return null;
};

export const XRayView: React.FC<XRayViewProps> = ({
  data,
  exposures,
  excludeArbitrage = false,
  onToggleExcludeArbitrage,
  onNavigateToIntersection,
}) => {
  const [viewMode, setViewMode] = useState<XRayViewMode>(loadStoredViewMode);
  const [selectedStockNode, setSelectedStockNode] = useState<HierarchyNode | null>(null);

  const handleSelectViewMode = (mode: XRayViewMode) => {
    setViewMode(mode);
    try {
      localStorage.setItem(VIEW_MODE_STORAGE_KEY, mode);
    } catch {
      // Ignore storage errors
    }
  };

  const rootHierarchyNode = useMemo(() => {
    if (!data || !data.sectors || data.totalValue === 0) return null;
    return buildPortfolioHierarchy(data, exposures, { excludeArbitrage, isDarkMode: false });
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
      <ExpenseAnalysis data={data} />

      <XRayViewModeControls
        viewMode={viewMode}
        onSelectViewMode={handleSelectViewMode}
        excludeArbitrage={excludeArbitrage}
        onToggleExcludeArbitrage={onToggleExcludeArbitrage}
      />

      <XRayCanvasBody
        viewMode={viewMode}
        rootHierarchyNode={rootHierarchyNode}
        data={data}
        onSelectStock={setSelectedStockNode}
      />

      <StockDetailDrawer
        isOpen={selectedStockNode !== null}
        node={selectedStockNode}
        onClose={() => setSelectedStockNode(null)}
        onInspectInIntersection={(stockName) => {
          setSelectedStockNode(null);
          onNavigateToIntersection?.(stockName);
        }}
      />
    </div>
  );
};
