/**
 * @file consolidation.ts
 * @description Re-exports and delegates to @portfolio/core-view for scheme consolidation.
 * Preserves backward compatibility for all existing web callers.
 */

import {
  consolidateFoliosIntoSchemes as coreConsolidate,
  computeGroupKey as coreComputeGroupKey,
  groupFoliosByKey as coreGroupFoliosByKey,
  sanitizeReturnRate as coreSanitizeReturnRate,
  type FolioInput,
  type ConsolidatedSchemeGroup,
} from '@portfolio/core-view';

export * from './consolidation-types';

/**
 * Bounds return rates within realistic limits to prevent math overflows.
 * Delegates to @portfolio/core-view.
 */
export function sanitizeReturnRate(
  rate: number | null | undefined,
  fallback: number = 0
): number {
  return coreSanitizeReturnRate(rate, fallback);
}

/**
 * Computes a unique group identifier for an individual folio based on ISIN, AMFI code, or normalized name.
 * Delegates to @portfolio/core-view.
 */
export function computeGroupKey(folio: FolioInput): string {
  return coreComputeGroupKey(folio);
}

/**
 * Groups an array of individual folios by their scheme group key.
 * Delegates to @portfolio/core-view.
 */
export function groupFoliosByKey(folios: FolioInput[]): Map<string, FolioInput[]> {
  return coreGroupFoliosByKey(folios);
}

/**
 * Consolidates an array of individual portfolio folios into distinct master schemes.
 * Delegates to @portfolio/core-view.
 *
 * @param folios - Array of individual folio objects to consolidate.
 * @returns Array of consolidated scheme groups with aggregated metrics.
 */
export function consolidateFoliosIntoSchemes(
  folios: FolioInput[] | null | undefined
): ConsolidatedSchemeGroup[] {
  return coreConsolidate(folios);
}
