/**
 * @file expense-calculation-service.ts
 * @description Computes fee drag and weighted average TER from holdings or backend analytics.
 */

import { type EnrichedHolding } from './portfolio-service';

/**
 * Breakdown of expenses per category.
 */
export interface CategoryExpenseBreakdown {
  category: string;
  totalFees: number;
  avgTer: number;
}

/**
 * Result of expense analysis calculation.
 */
export interface ExpenseAnalysisResult {
  totalAnnualFees: number;
  weightedAvgTer: number;
  categoryBreakdown: CategoryExpenseBreakdown[];
}

function getHoldingTer(schemeName: string, assetClass: string): number {
  const name = schemeName.toLowerCase();
  const cls = assetClass.toLowerCase();

  if (cls.includes('debt') || cls.includes('liquid') || name.includes('liquid')) {
    return name.includes('direct') ? 0.25 : 0.60;
  }
  if (name.includes('sgb') || name.includes('sovereign gold')) {
    return 0;
  }
  if (cls.includes('gold') || name.includes('gold')) {
    return 0.50;
  }
  if (name.includes('direct')) {
    return 0.75;
  }
  return 1.50;
}

function getHoldingCategory(schemeName: string, assetClass: string): string {
  const name = schemeName.toLowerCase();
  const cls = assetClass.toLowerCase();

  if (cls.includes('debt') || name.includes('bond')) return 'Debt Funds';
  if (cls.includes('liquid') || name.includes('liquid')) return 'Liquid / Money Market';
  if (cls.includes('gold') || name.includes('gold')) return 'Precious Metals (Gold)';
  if (name.includes('hybrid') || cls.includes('hybrid')) return 'Hybrid / Multi-Asset';
  return 'Equity Funds';
}

interface CategoryAccumulator {
  value: number;
  fees: number;
}

function processHoldingCategory(
  cats: Map<string, CategoryAccumulator>,
  h: EnrichedHolding,
): { val: number; fee: number } {
  const val = Math.max(0, h.current_value);
  if (val <= 0) return { val: 0, fee: 0 };

  const ter = getHoldingTer(h.scheme_name, h.asset_class || '');
  const fee = (val * ter) / 100;
  const category = getHoldingCategory(h.scheme_name, h.asset_class || '');

  const existing = cats.get(category) ?? { value: 0, fees: 0 };
  cats.set(category, {
    value: existing.value + val,
    fees: existing.fees + fee,
  });

  return { val, fee };
}

/**
 * Computes annualized total fees and weighted average expense ratio from holdings.
 *
 * @param holdings - Portfolio holdings list.
 * @returns Expense analysis metrics and category breakdown.
 */
export function calculateExpenseAnalysis(holdings: readonly EnrichedHolding[]): ExpenseAnalysisResult {
  const categoryMap = new Map<string, CategoryAccumulator>();
  let totalVal = 0;
  let totalFees = 0;

  for (const h of holdings) {
    const { val, fee } = processHoldingCategory(categoryMap, h);
    totalVal += val;
    totalFees += fee;
  }

  const weightedAvgTer = totalVal > 0 ? (totalFees / totalVal) * 100 : 0;

  const categoryBreakdown: CategoryExpenseBreakdown[] = Array.from(categoryMap.entries()).map(
    ([category, acc]) => ({
      category,
      totalFees: Math.round(acc.fees),
      avgTer: acc.value > 0 ? (acc.fees / acc.value) * 100 : 0,
    }),
  );

  return {
    totalAnnualFees: Math.round(totalFees),
    weightedAvgTer,
    categoryBreakdown,
  };
}
