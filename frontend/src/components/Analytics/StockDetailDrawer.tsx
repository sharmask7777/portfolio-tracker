/**
 * @file StockDetailDrawer.tsx
 * @module components/Analytics/StockDetailDrawer
 * @description Slide-over inspection drawer / bottom sheet detailing underlying look-through stock holdings,
 * mutual fund contributions, portfolio weights, and cross-tab drilldown navigation.
 *
 * Implements WCAG 2.1 AA dialog semantics with backdrop overlay, Escape key listener, and accessible
 * progress bars tracking each mutual fund scheme's contribution.
 */

import React, { useEffect, useCallback } from 'react';
import { X, ExternalLink, Layers, PieChart } from 'lucide-react';
import type { HierarchyNode, StockContribution } from '../../utils/hierarchy-builder';
import { formatIndianRupee } from '../../utils/hierarchy-builder';

/**
 * Props for {@link StockDetailDrawer}.
 */
export interface StockDetailDrawerProps {
  /** Whether the drawer slide-over panel is visible. */
  isOpen: boolean;
  /** Active stock hierarchy node to inspect, or null/undefined if closed. */
  node?: HierarchyNode | null | undefined;
  /** Callback fired when drawer requests to be closed (close button, backdrop, Escape). */
  onClose: () => void;
  /** Callback fired when user requests to inspect this company inside the Stock Intersection view. */
  onInspectInIntersection?: ((stockName: string) => void) | undefined;
}

/**
 * Renders an accessible slide-over drawer displaying company look-through details and fund contributions.
 */
export const StockDetailDrawer: React.FC<StockDetailDrawerProps> = ({
  isOpen,
  node,
  onClose,
  onInspectInIntersection,
}) => {
  // Close drawer on Escape key press
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        onClose();
      }
    },
    [isOpen, onClose]
  );

  useEffect(() => {
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        window.removeEventListener('keydown', handleKeyDown);
      };
    }
    return undefined;
  }, [isOpen, handleKeyDown]);

  if (!isOpen || !node) {
    return null;
  }

  const stockName = node.name;
  const sectorName = node.sector ?? 'Equity';
  const totalRupeeValue = node.metrics.signedValue;
  const portfolioWeightPct = (node.metrics.weightOfPortfolio * 100).toFixed(2);
  const schemeCount = node.schemeCount ?? node.contributions?.length ?? 0;
  const contributions: StockContribution[] = node.contributions ?? [];

  // Calculate highest scheme value for relative bar widths
  const maxSchemeValue = contributions.reduce(
    (max, item) => (item.value > max ? item.value : max),
    0
  );

  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden"
      aria-labelledby="stock-drawer-title"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop overlay */}
      <div
        data-testid="drawer-backdrop"
        className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col">
          {/* Header */}
          <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-start justify-between bg-slate-50 dark:bg-slate-800/50">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span
                  className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                  style={{ backgroundColor: `${node.color}20`, color: node.color }}
                >
                  {sectorName}
                </span>
                {node.isHedged && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300">
                    Hedged Arbitrage
                  </span>
                )}
              </div>
              <h2
                id="stock-drawer-title"
                className="text-xl font-bold text-slate-900 dark:text-white"
              >
                {stockName}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close drawer"
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Metric Cards */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                <span className="text-xs text-slate-500 dark:text-slate-400 font-medium block mb-1">
                  Total Rupee Holding
                </span>
                <span className="text-xl font-bold text-slate-900 dark:text-white">
                  {formatIndianRupee(totalRupeeValue)}
                </span>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                <span className="text-xs text-slate-500 dark:text-slate-400 font-medium block mb-1">
                  Portfolio Weight
                </span>
                <span className="text-xl font-bold text-blue-600 dark:text-blue-400">
                  {portfolioWeightPct}% of Portfolio
                </span>
              </div>
            </div>

            {/* Overlap badge */}
            <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/40 rounded-lg text-blue-900 dark:text-blue-200 text-sm">
              <Layers className="w-4 h-4 shrink-0 text-blue-600 dark:text-blue-400" />
              <span>
                Present in {schemeCount} Mutual Fund{schemeCount === 1 ? '' : 's'}
              </span>
            </div>

            {/* Mutual Fund Contributions */}
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white uppercase tracking-wider mb-3 flex items-center gap-2">
                <PieChart className="w-4 h-4 text-slate-500" />
                Contributing Mutual Funds
              </h3>

              {contributions.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400 italic">
                  Direct stock holding or undisclosed scheme distribution.
                </p>
              ) : (
                <div className="space-y-4">
                  {contributions.map((contribution, index) => {
                    const relativePct =
                      maxSchemeValue > 0
                        ? Math.min(100, Math.max(5, (contribution.value / maxSchemeValue) * 100))
                        : 0;
                    const fundWeightPct = (contribution.weight * 100).toFixed(2);

                    return (
                      <div
                        key={`${contribution.schemeName}-${index}`}
                        className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200/60 dark:border-slate-800 space-y-2"
                      >
                        <div className="flex justify-between items-start text-sm">
                          <span className="font-medium text-slate-900 dark:text-slate-200 flex-1 pr-2">
                            {contribution.schemeName}
                          </span>
                          <span className="font-semibold text-slate-900 dark:text-white shrink-0">
                            {formatIndianRupee(contribution.value)}
                          </span>
                        </div>

                        {/* Progress Bar */}
                        <div className="space-y-1">
                          <div
                            role="progressbar"
                            aria-valuenow={contribution.value}
                            aria-valuemin={0}
                            aria-valuemax={maxSchemeValue}
                            aria-label={`${contribution.schemeName} exposure`}
                            className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden"
                          >
                            <div
                              className="h-full bg-blue-600 dark:bg-blue-500 rounded-full transition-all duration-300"
                              style={{ width: `${relativePct}%` }}
                            />
                          </div>
                          <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
                            <span>{fundWeightPct}% fund weight</span>
                            <span>{relativePct.toFixed(0)}% of stock</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Footer CTA */}
          <div className="p-6 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
            <button
              type="button"
              onClick={() => {
                if (onInspectInIntersection) {
                  onInspectInIntersection(stockName);
                }
              }}
              className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-sm flex items-center justify-center gap-2 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
            >
              <ExternalLink className="w-4 h-4" />
              <span>Inspect in Stock Intersection</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
