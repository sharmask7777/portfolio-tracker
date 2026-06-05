export type SortField = 'name' | 'type' | 'invested' | 'value' | 'dayChange' | 'performance' | 'postTaxPerformance';
export type SortDirection = 'asc' | 'desc';

export function sortFolios(
  folios: any[],
  sortField: SortField | null,
  sortDirection: SortDirection | null,
  performanceMode: 'XIRR' | 'ABS'
): any[] {
  if (!folios) return [];
  const foliosCopy = [...folios];
  if (!sortField || !sortDirection) return foliosCopy;

  return foliosCopy.sort((a, b) => {
    let aVal: any;
    let bVal: any;

    switch (sortField) {
      case 'name':
        aVal = a.asset?.name?.toLowerCase() || '';
        bVal = b.asset?.name?.toLowerCase() || '';
        break;
      case 'type':
        aVal = a.asset?.type?.toLowerCase() || '';
        bVal = b.asset?.type?.toLowerCase() || '';
        break;
      case 'invested':
        aVal = a.metrics?.investedAmount ?? 0;
        bVal = b.metrics?.investedAmount ?? 0;
        break;
      case 'value':
        aVal = a.metrics?.currentValue ?? 0;
        bVal = b.metrics?.currentValue ?? 0;
        break;
      case 'dayChange':
        aVal = a.metrics?.dayChange ?? 0;
        bVal = b.metrics?.dayChange ?? 0;
        break;
      case 'performance':
        aVal = performanceMode === 'XIRR' ? (a.metrics?.xirr ?? 0) : (a.metrics?.absoluteReturn ?? 0);
        bVal = performanceMode === 'XIRR' ? (b.metrics?.xirr ?? 0) : (b.metrics?.absoluteReturn ?? 0);
        break;
      case 'postTaxPerformance':
        aVal = performanceMode === 'XIRR' ? (a.metrics?.postTaxXirr ?? 0) : (a.metrics?.postTaxAbsoluteReturn ?? 0);
        bVal = performanceMode === 'XIRR' ? (b.metrics?.postTaxXirr ?? 0) : (b.metrics?.postTaxAbsoluteReturn ?? 0);
        break;
      default:
        return 0;
    }

    if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });
}
