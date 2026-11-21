/**
 * @file sorting.ts
 * @description Sorting functions for consolidated scheme groups.
 */

import type {
  ConsolidatedSchemeGroup,
  ConsolidatedMetrics,
  SchemeSortField,
  SortDirection,
  PerformanceMode,
} from './types';

/**
 * Compares two primitive values by sort direction.
 */
function compareValues<T extends string | number>(
  aVal: T,
  bVal: T,
  direction: SortDirection
): number {
  if (aVal < bVal) return direction === 'asc' ? -1 : 1;
  if (aVal > bVal) return direction === 'asc' ? 1 : -1;
  return 0;
}

/**
 * Resolves metric value by sort field and performance mode.
 */
function resolveMetricValue(
  metrics: ConsolidatedMetrics,
  field: SchemeSortField,
  mode: PerformanceMode
): number {
  if (field === 'invested') return metrics.investedAmount;
  if (field === 'value') return metrics.currentValue;
  if (field === 'dayChange') return metrics.dayChange;
  if (field === 'postTaxPerformance') {
    return mode === 'XIRR' ? metrics.postTaxXirr : metrics.postTaxAbsoluteReturn;
  }
  return mode === 'XIRR' ? metrics.xirr : metrics.absoluteReturn;
}

/**
 * Extracts sort value from a scheme group.
 */
function extractSchemeGroupSortValue(
  group: ConsolidatedSchemeGroup,
  field: SchemeSortField,
  mode: PerformanceMode
): string | number {
  if (field === 'name') return group.schemeName.toLowerCase();
  if (field === 'type') return group.type.toLowerCase();
  return resolveMetricValue(group.metrics, field, mode);
}

/**
 * Sorts consolidated scheme groups by specified field, direction, and performance mode.
 *
 * @param groups - Array of scheme groups.
 * @param sortField - Field to sort by.
 * @param sortDirection - 'asc' or 'desc'.
 * @param performanceMode - 'XIRR' or 'ABS'.
 * @returns Sorted array of scheme groups.
 */
export function sortSchemeGroups(
  groups: readonly ConsolidatedSchemeGroup[] | null | undefined,
  sortField: SchemeSortField | null,
  sortDirection: SortDirection | null,
  performanceMode: PerformanceMode = 'XIRR'
): ConsolidatedSchemeGroup[] {
  if (!groups) return [];
  const groupsCopy = [...groups];
  if (!sortField || !sortDirection) return groupsCopy;

  return groupsCopy.sort((a, b) => {
    const aVal = extractSchemeGroupSortValue(a, sortField, performanceMode);
    const bVal = extractSchemeGroupSortValue(b, sortField, performanceMode);
    return compareValues(aVal, bVal, sortDirection);
  });
}
