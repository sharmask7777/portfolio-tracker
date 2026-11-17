/**
 * @file TreemapHeader.tsx
 * @module components/Analytics/TreemapHeader
 * @description Breadcrumb navigation and zoom controls for MultiLevelTreemap.
 */

import React from 'react';
import { ChevronRight, ChevronLeft } from 'lucide-react';
import type { HierarchyNode } from '../../utils/hierarchy-builder';

interface TreemapHeaderProps {
  navPath: HierarchyNode[];
  canZoomOut: boolean;
  onBreadcrumbClick: (index: number) => void;
  onZoomOut: () => void;
}

export const TreemapHeader: React.FC<TreemapHeaderProps> = ({
  navPath,
  canZoomOut,
  onBreadcrumbClick,
  onZoomOut,
}) => {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
      <nav aria-label="Hierarchy Breadcrumbs" className="flex items-center flex-wrap gap-1 text-sm">
        {navPath.map((item, idx) => {
          const isLast = idx === navPath.length - 1;
          const displayName = idx === 0 ? 'All Assets' : item.name;

          return (
            <React.Fragment key={item.id}>
              {idx > 0 && <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />}
              {isLast ? (
                <span className="font-semibold text-slate-900 dark:text-white" aria-current="page">
                  {displayName}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => onBreadcrumbClick(idx)}
                  className="text-blue-600 dark:text-blue-400 hover:underline font-medium focus:outline-none focus:ring-1 focus:ring-blue-500 rounded px-1"
                >
                  {displayName}
                </button>
              )}
            </React.Fragment>
          );
        })}
      </nav>

      {canZoomOut && (
        <button
          type="button"
          onClick={onZoomOut}
          className="flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700/60 shadow-xs transition-colors"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          <span>Zoom Out</span>
        </button>
      )}
    </div>
  );
};
