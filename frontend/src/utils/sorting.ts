import type { ConsolidatedSchemeGroup } from './consolidation';

export interface SortableAsset {
  name: string;
  type: string;
}

export interface SortableFolioMetrics {
  investedAmount?: number;
  currentValue?: number;
  dayChange?: number;
  xirr?: number;
  postTaxXirr?: number;
  absoluteReturn?: number;
  postTaxAbsoluteReturn?: number;
}

export interface SortableFolio {
  id: string;
  asset: SortableAsset;
  metrics: SortableFolioMetrics;
}

export type SortField = 'name' | 'type' | 'invested' | 'value' | 'dayChange' | 'performance' | 'postTaxPerformance';
export type SortDirection = 'asc' | 'desc';

interface SortTarget {
  name?: string;
  type?: string;
  metrics?: SortableFolioMetrics;
}

function extractPerformanceMetric(
  field: 'performance' | 'postTaxPerformance',
  metrics: SortableFolioMetrics | undefined,
  performanceMode: 'XIRR' | 'ABS'
): number {
  if (field === 'performance') {
    return performanceMode === 'XIRR' ? (metrics?.xirr ?? 0) : (metrics?.absoluteReturn ?? 0);
  }
  return performanceMode === 'XIRR' ? (metrics?.postTaxXirr ?? 0) : (metrics?.postTaxAbsoluteReturn ?? 0);
}

function extractCoreMetric(
  field: 'invested' | 'value' | 'dayChange',
  metrics: SortableFolioMetrics | undefined
): number {
  if (field === 'invested') return metrics?.investedAmount ?? 0;
  if (field === 'value') return metrics?.currentValue ?? 0;
  return metrics?.dayChange ?? 0;
}

function extractSortValue(
  target: SortTarget,
  field: SortField,
  performanceMode: 'XIRR' | 'ABS'
): string | number {
  if (field === 'name') return target.name?.toLowerCase() || '';
  if (field === 'type') return target.type?.toLowerCase() || '';
  if (field === 'invested' || field === 'value' || field === 'dayChange') {
    return extractCoreMetric(field, target.metrics);
  }
  return extractPerformanceMetric(field, target.metrics, performanceMode);
}

function compareValues(aVal: string | number, bVal: string | number, direction: SortDirection): number {
  if (aVal < bVal) return direction === 'asc' ? -1 : 1;
  if (aVal > bVal) return direction === 'asc' ? 1 : -1;
  return 0;
}

export function sortFolios(
  folios: SortableFolio[],
  sortField: SortField | null,
  sortDirection: SortDirection | null,
  performanceMode: 'XIRR' | 'ABS'
): SortableFolio[] {
  if (!folios) return [];
  const foliosCopy = [...folios];
  if (!sortField || !sortDirection) return foliosCopy;

  return foliosCopy.sort((a, b) => {
    const aTarget: SortTarget = { name: a.asset?.name, type: a.asset?.type, metrics: a.metrics };
    const bTarget: SortTarget = { name: b.asset?.name, type: b.asset?.type, metrics: b.metrics };
    const aVal = extractSortValue(aTarget, sortField, performanceMode);
    const bVal = extractSortValue(bTarget, sortField, performanceMode);
    return compareValues(aVal, bVal, sortDirection);
  });
}

export function sortSchemeGroups(
  groups: ConsolidatedSchemeGroup[],
  sortField: SortField | null,
  sortDirection: SortDirection | null,
  performanceMode: 'XIRR' | 'ABS'
): ConsolidatedSchemeGroup[] {
  if (!groups) return [];
  const groupsCopy = [...groups];
  if (!sortField || !sortDirection) return groupsCopy;

  return groupsCopy.sort((a, b) => {
    const aTarget: SortTarget = { name: a.schemeName, type: a.type, metrics: a.metrics };
    const bTarget: SortTarget = { name: b.schemeName, type: b.type, metrics: b.metrics };
    const aVal = extractSortValue(aTarget, sortField, performanceMode);
    const bVal = extractSortValue(bTarget, sortField, performanceMode);
    return compareValues(aVal, bVal, sortDirection);
  });
}
