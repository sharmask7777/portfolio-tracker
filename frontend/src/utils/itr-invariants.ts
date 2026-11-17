/**
 * @file itr-invariants.ts
 * @module utils/itr-invariants
 * @description Invariant validation functions for ITR Schedule CG and Table F reporting.
 */

import type {
  ITRVerificationTarget,
  ITRQuarterlySummary,
  AdvanceTaxAccrualMatrix,
  AdvanceTaxQuarter,
} from './itr-report-types';

function extractNetRealizedTotal(report: ITRVerificationTarget): number | undefined {
  if (report.realized?.total !== undefined) return report.realized.total;
  if (report.summary?.realized?.total !== undefined) return report.summary.realized.total;
  if (report.totalGain !== undefined) return report.totalGain;
  if (report.totalCapitalGain !== undefined) return report.totalCapitalGain;
  if (Array.isArray(report.details)) {
    return report.details.reduce((sum: number, item: { gain?: number }) => sum + (item.gain ?? 0), 0);
  }
  return undefined;
}

function verifyQuarterlySummary(
  quarterlySummary: ITRQuarterlySummary,
  netRealizedTotal: number | undefined
): void {
  const quarterlySum =
    (quarterlySummary.q1 ?? 0) +
    (quarterlySummary.q2 ?? 0) +
    (quarterlySummary.q2a ?? 0) +
    (quarterlySummary.q2b ?? 0) +
    (quarterlySummary.q3 ?? 0) +
    (quarterlySummary.q4 ?? 0) +
    (quarterlySummary.q5 ?? 0);

  if (quarterlySummary.total !== undefined && Math.abs(quarterlySum - quarterlySummary.total) > 0.01) {
    throw new Error(
      `Invariant violated: quarterly accrued gains (${quarterlySum}) do not sum to quarterly total (${quarterlySummary.total})`
    );
  }

  if (netRealizedTotal !== undefined) {
    if (Math.abs(quarterlySum - netRealizedTotal) > 0.01) {
      throw new Error(
        `Invariant violated: quarterly accrued gains (${quarterlySum}) do not sum to total capital gain (${netRealizedTotal})`
      );
    }
    if (quarterlySummary.total !== undefined && Math.abs(quarterlySummary.total - netRealizedTotal) > 0.01) {
      throw new Error(
        `Invariant violated: quarterly total (${quarterlySummary.total}) does not match portfolio realized total (${netRealizedTotal})`
      );
    }
  }
}

function verifyAdvanceTaxMatrix(
  matrix: AdvanceTaxAccrualMatrix | undefined,
  netRealizedTotal: number | undefined
): void {
  if (!matrix || !matrix.quarters) return;

  let matrixSum = 0;
  for (const quarterKey of Object.keys(matrix.quarters)) {
    const quarterData = matrix.quarters[quarterKey as AdvanceTaxQuarter];
    if (quarterData) {
      matrixSum += quarterData.totalGain ?? 0;
    }
  }

  if (netRealizedTotal !== undefined && Math.abs(matrixSum - netRealizedTotal) > 0.01) {
    throw new Error(
      `Invariant violated: Table F quarterly accrued gains (${matrixSum}) do not sum to net realized gain (${netRealizedTotal})`
    );
  }
}

function verifyExemptionLimits(report: ITRVerificationTarget, fy: string): void {
  const startYear = parseInt(String(fy).split('-')[0] ?? '', 10);
  const isPostBudget = !isNaN(startYear) ? startYear >= 2024 : fy >= '2024-25';
  const statutoryLimit = isPostBudget ? 125000 : 100000;

  const claimedExemption =
    report.exemptLtcg ??
    report.totalExemption ??
    report.exempt112A ??
    report.exempt_ltcg_112a ??
    report.exemptionClaimed;

  if (claimedExemption !== undefined) {
    if (claimedExemption < -0.001) {
      throw new Error(
        `Invariant violated: Section 112A exemption claimed cannot be negative (${claimedExemption})`
      );
    }
    if (claimedExemption > statutoryLimit + 0.01) {
      throw new Error(
        `Invariant violated: Section 112A exemption claimed (${claimedExemption}) exceeds statutory limit (${statutoryLimit}) for FY ${fy}`
      );
    }
  }
}

function assertNonNegative(val: number | undefined, label: string): void {
  if (val !== undefined && val < -0.001) {
    throw new Error(`Invariant violated: ${label} cannot be negative after set-off (${val})`);
  }
}

function resolveTaxableSlice(
  r: { taxableStcg?: number; taxableLtcg?: number; taxableSlab?: number } | undefined,
  fallbackVal: number | undefined,
  key: 'taxableStcg' | 'taxableLtcg' | 'taxableSlab'
): number | undefined {
  if (r && r[key] !== undefined) return r[key];
  return fallbackVal;
}

function verifyNonNegativeTaxableGains(report: ITRVerificationTarget): void {
  const r = report.realized ?? report.summary?.realized;
  const stcg = resolveTaxableSlice(r, report.taxableStcg, 'taxableStcg');
  const ltcg = resolveTaxableSlice(r, report.taxableLtcg, 'taxableLtcg');
  const slab = resolveTaxableSlice(r, report.taxableSlab, 'taxableSlab');

  assertNonNegative(stcg, 'taxable STCG');
  assertNonNegative(ltcg, 'taxable LTCG');
  assertNonNegative(slab, 'taxable slab gain');

  const explicitTotal = report.taxableGain ?? report.taxableTotal;
  const computedTotal = (stcg !== undefined || ltcg !== undefined || slab !== undefined)
    ? (stcg ?? 0) + (ltcg ?? 0) + (slab ?? 0)
    : undefined;
  const total = explicitTotal ?? computedTotal;

  assertNonNegative(total, 'taxable gain');
}

/**
 * Verifies statutory ITR capital gains invariants before report generation or export.
 *
 * @param report - Complete report or verification target to validate.
 * @throws Error if any statutory invariant is violated.
 */
export function verifyItrInvariants(report: ITRVerificationTarget): void {
  if (!report) {
    throw new Error('Invariant violated: report data is required for invariant verification');
  }

  const fy = report.fy || report.financialYear || '2024-25';
  const netRealizedTotal = extractNetRealizedTotal(report);

  if (report.quarterlySummary) {
    verifyQuarterlySummary(report.quarterlySummary, netRealizedTotal);
  }

  const matrix: AdvanceTaxAccrualMatrix | undefined =
    report.advanceTaxMatrix || report.tableF || report.summary?.tableF;
  verifyAdvanceTaxMatrix(matrix, netRealizedTotal);

  verifyExemptionLimits(report, fy);
  verifyNonNegativeTaxableGains(report);
}
