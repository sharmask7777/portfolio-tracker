/**
 * @file StockDrawerHeader.tsx
 * @module components/Analytics/StockDrawerHeader
 * @description Header component for StockDetailDrawer.
 */

import React from 'react';
import { X } from 'lucide-react';
import type { HierarchyNode } from '../../utils/hierarchy-builder';

interface StockDrawerHeaderProps {
  node: HierarchyNode;
  onClose: () => void;
}

export const StockDrawerHeader: React.FC<StockDrawerHeaderProps> = ({ node, onClose }) => {
  const sectorName = node.sector ?? 'Equity';

  return (
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
        <h2 id="stock-drawer-title" className="text-xl font-bold text-slate-900 dark:text-white">
          {node.name}
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
  );
};
