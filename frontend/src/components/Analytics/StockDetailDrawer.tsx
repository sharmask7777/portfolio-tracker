/**
 * @file StockDetailDrawer.tsx
 * @module components/Analytics/StockDetailDrawer
 * @description Accessible slide-over drawer displaying underlying corporate look-through details.
 */

import React, { useEffect, useCallback } from 'react';
import { Layers, ExternalLink } from 'lucide-react';
import type { HierarchyNode, StockContribution } from '../../utils/hierarchy-builder';
import { formatIndianRupee } from '../../utils/hierarchy-builder';
import { StockContributionsList } from './StockContributionsList';
import { StockDrawerHeader } from './StockDrawerHeader';

interface StockDetailDrawerProps {
  isOpen: boolean;
  node: HierarchyNode | null;
  onClose: () => void;
  onInspectInIntersection?: (stockName: string) => void;
}

export const StockDetailDrawer: React.FC<StockDetailDrawerProps> = ({
  isOpen,
  node,
  onClose,
  onInspectInIntersection,
}) => {
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
  const totalRupeeValue = node.metrics.signedValue;
  const portfolioWeightPct = (node.metrics.weightOfPortfolio * 100).toFixed(2);
  const schemeCount = node.schemeCount ?? node.contributions?.length ?? 0;
  const contributions: StockContribution[] = node.contributions ?? [];

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
      <div
        data-testid="drawer-backdrop"
        className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col">
          <StockDrawerHeader node={node} onClose={onClose} />

          <div className="flex-1 overflow-y-auto p-6 space-y-6">
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

            <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/40 rounded-lg text-blue-900 dark:text-blue-200 text-sm">
              <Layers className="w-4 h-4 shrink-0 text-blue-600 dark:text-blue-400" />
              <span>
                Present in {schemeCount} Mutual Fund{schemeCount === 1 ? '' : 's'}
              </span>
            </div>

            <StockContributionsList
              contributions={contributions}
              maxSchemeValue={maxSchemeValue}
            />
          </div>

          <div className="p-6 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
            <button
              type="button"
              onClick={() => onInspectInIntersection?.(stockName)}
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
