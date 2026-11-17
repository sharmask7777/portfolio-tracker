/**
 * @file XRayViewModeControls.tsx
 * @module components/Analytics/XRayViewModeControls
 * @description View switcher and arbitrage controls for XRayView.
 */

import React from 'react';

export type XRayViewMode = 'treemap' | 'sunburst' | 'classic';

interface XRayViewModeControlsProps {
  viewMode: XRayViewMode;
  onSelectViewMode: (mode: XRayViewMode) => void;
  excludeArbitrage: boolean;
  onToggleExcludeArbitrage?: ((exclude: boolean) => void) | undefined;
}

export const XRayViewModeControls: React.FC<XRayViewModeControlsProps> = ({
  viewMode,
  onSelectViewMode,
  excludeArbitrage,
  onToggleExcludeArbitrage,
}) => {
  return (
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
      <div className="segmented-control" role="tablist" aria-label="X-Ray View Mode">
        <button
          type="button"
          role="tab"
          aria-selected={viewMode === 'treemap'}
          className={viewMode === 'treemap' ? 'active' : ''}
          onClick={() => onSelectViewMode('treemap')}
        >
          Zoomable Treemap
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={viewMode === 'sunburst'}
          className={viewMode === 'sunburst' ? 'active' : ''}
          onClick={() => onSelectViewMode('sunburst')}
        >
          Concentric Sunburst
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={viewMode === 'classic'}
          className={viewMode === 'classic' ? 'active' : ''}
          onClick={() => onSelectViewMode('classic')}
        >
          Classic Grid
        </button>
      </div>

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
  );
};
