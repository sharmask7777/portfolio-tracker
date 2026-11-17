/**
 * @file StockContributionsList.tsx
 * @module components/Analytics/StockContributionsList
 * @description Renders the mutual fund breakdown progress bars in StockDetailDrawer.
 */

import React from 'react';
import { PieChart } from 'lucide-react';
import type { StockContribution } from '../../utils/hierarchy-builder';
import { formatIndianRupee } from '../../utils/hierarchy-builder';

interface StockContributionsListProps {
  contributions: StockContribution[];
  maxSchemeValue: number;
}

export const StockContributionsList: React.FC<StockContributionsListProps> = ({
  contributions,
  maxSchemeValue,
}) => {
  return (
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
  );
};
