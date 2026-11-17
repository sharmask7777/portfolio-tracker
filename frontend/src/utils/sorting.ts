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

export type SortField =
  | 'name'
  | 'type'
  | 'invested'
  | 'value'
  | 'dayChange'
  | 'performance'
  | 'postTaxPerformance';
export type SortDirection = 'asc' | 'desc';

function compareValues<T extends string | number>(
  aVal: T,
  bVal: T,
  direction: SortDirection
): number {
  if (aVal < bVal) return direction === 'asc' ? -1 : 1;
  if (aVal > bVal) return direction === 'asc' ? 1 : -1;
  return 0;
}

function resolveMetricValue(
  metrics: SortableFolioMetrics | undefined,
  field: SortField,
  mode: 'XIRR' | 'ABS'
): number {
  if (!metrics) return 0;
  if (field === 'invested') return metrics.investedAmount ?? 0;
  if (field === 'value') return metrics.currentValue ?? 0;
  if (field === 'dayChange') return metrics.dayChange ?? 0;
  if (field === 'postTaxPerformance') {
    return mode === 'XIRR' ? (metrics.postTaxXirr ?? 0) : (metrics.postTaxAbsoluteReturn ?? 0);
  }
  return mode === 'XIRR' ? (metrics.xirr ?? 0) : (metrics.absoluteReturn ?? 0);
}

function extractFolioSortValue(
  folio: SortableFolio,
  field: SortField,
  mode: 'XIRR' | 'ABS'
): string | number {
  if (field === 'name') return folio.asset?.name?.toLowerCase() || '';
  if (field === 'type') return folio.asset?.type?.toLowerCase() || '';
  return resolveMetricValue(folio.metrics, field, mode);
}

function extractSchemeGroupSortValue(
  group: ConsolidatedSchemeGroup,
  field: SortField,
  mode: 'XIRR' | 'ABS'
): string | number {
  if (field === 'name') return group.schemeName?.toLowerCase() || '';
  if (field === 'type') return group.type?.toLowerCase() || '';
  return resolveMetricValue(group.metrics, field, mode);
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
    const aVal = extractFolioSortValue(a, sortField, performanceMode);
    const bVal = extractFolioSortValue(b, sortField, performanceMode);
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
    const aVal = extractSchemeGroupSortValue(a, sortField, performanceMode);
    const bVal = extractSchemeGroupSortValue(b, sortField, performanceMode);
    return compareValues(aVal, bVal, sortDirection);
  });
}
