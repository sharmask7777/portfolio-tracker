/**
 * @file tax-formatters.ts
 * @module utils/tax-formatters
 * @description Pure presentation formatters for statutory tax sections and Assessment Years.
 */

import { TaxSectionName, type ITRGainDetail } from './itr-report-types';

/**
 * Computes the official Assessment Year (AY) string corresponding to a Financial Year (FY).
 * Example: '2024-25' -> '2025-26'
 */
export function computeAY(fy: string): string {
  const startYear = parseInt(fy.split('-')[0] ?? '', 10);
  const ayStartYear = startYear + 1;
  const ayEndYear = (startYear + 2).toString().slice(-2);
  return `${ayStartYear}-${ayEndYear}`;
}

function isPostBudgetSell(sellDate: Date | string | undefined): boolean {
  if (!sellDate) return false;
  return String(sellDate) >= '2024-07-23';
}

/**
 * Classifies an individual realized capital gain lot into its exact statutory Income Tax Section display label.
 */
export function classifySection(gainItem: Partial<ITRGainDetail>): string {
  if (gainItem.section) return gainItem.section;

  const { taxType, assetClass, taxRate, isGrandfathered, sellDate } = gainItem;
  const isPostBudget = isPostBudgetSell(sellDate);

  if (taxType === 'STCG') {
    if (taxRate === 0.20 || (!taxRate && isPostBudget)) {
      return TaxSectionName.SEC_111A_20;
    }
    return TaxSectionName.SEC_111A_15;
  }

  if (taxType === 'LTCG') {
    const isDebt = assetClass === 'DEBT' || (taxRate === 0.20 && isGrandfathered);
    if (isDebt) {
      return taxRate === 0.20 ? TaxSectionName.SEC_112_DEBT_20 : TaxSectionName.SEC_112_DEBT_12_5;
    }
    if (taxRate === 0.125 || (!isGrandfathered && isPostBudget)) {
      return TaxSectionName.SEC_112A_12_5;
    }
    return TaxSectionName.SEC_112A_10;
  }

  if (taxType === 'SLAB') {
    return TaxSectionName.SEC_50AA;
  }

  return TaxSectionName.SLAB;
}
