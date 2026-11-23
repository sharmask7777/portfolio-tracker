import { useState } from 'react';
import type { SchemeSortField, SortDirection } from '@portfolio/core-view';
import type { FolioView } from './types/generated/FolioView';
import type { PanelFolio } from './components/Dashboard/TransactionSidePanel';

export function useDashboardSelection() {
  const [selectedFamilyId, setSelectedFamilyId] = useState<string | null>(null);
  const [intersectionSearchQuery, setIntersectionSearchQuery] = useState<string>('');
  const [excludeArbitrage, setExcludeArbitrage] = useState<boolean>(false);
  const [simFolio, setSimFolio] = useState<FolioView | null>(null);
  const [simUnits, setSimUnits] = useState<number | null>(null);
  const [selectedFolioForTransactions, setSelectedFolioForTransactions] = useState<PanelFolio | null>(null);
  const [sortField, setSortField] = useState<SchemeSortField | null>('value');
  const [sortDirection, setSortDirection] = useState<SortDirection | null>('desc');
  const [showClosedFolios, setShowClosedFolios] = useState(false);

  const handleSort = (field: SchemeSortField) => {
    if (sortField !== field) {
      setSortField(field);
      setSortDirection('desc');
    } else if (sortDirection === 'desc') {
      setSortDirection('asc');
    } else if (sortDirection === 'asc') {
      setSortField(null);
      setSortDirection(null);
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  return {
    selectedFamilyId,
    setSelectedFamilyId,
    intersectionSearchQuery,
    setIntersectionSearchQuery,
    excludeArbitrage,
    setExcludeArbitrage,
    simFolio,
    setSimFolio,
    simUnits,
    setSimUnits,
    selectedFolioForTransactions,
    setSelectedFolioForTransactions,
    sortField,
    sortDirection,
    showClosedFolios,
    setShowClosedFolios,
    handleSort,
  };
}
