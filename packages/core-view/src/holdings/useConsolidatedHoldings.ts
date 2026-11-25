/**
 * @file useConsolidatedHoldings.ts
 * @description Framework-agnostic React hook / selector for consolidating folios, filtering, searching, and managing expansion state.
 */

import { useState, useMemo, useCallback } from 'react';
import { consolidateFoliosIntoSchemes, sortSchemeGroups } from '../consolidation/scheme-consolidator';
import type {
  FolioInput,
  ConsolidatedSchemeGroup,
  PerformanceMode,
  SchemeSortField,
  SortDirection,
} from '../consolidation/types';
import type { PortfolioScope } from '../scope/usePortfolioScope';

export interface UseConsolidatedHoldingsOptions {
  /** Array of raw individual folios */
  readonly folios?: readonly FolioInput[] | null | undefined;
  /** Active portfolio scope */
  readonly scope?: PortfolioScope | undefined;
  /** Search query to filter scheme names, ISIN, or folio numbers */
  readonly searchQuery?: string | undefined;
  /** Asset class or type filter (e.g. 'EQUITY', 'DEBT', 'MUTUAL_FUND') */
  readonly assetTypeFilter?: string | undefined;
  /** Performance display mode: 'XIRR' or 'ABS' */
  readonly performanceMode?: PerformanceMode | undefined;
  /** Field to sort by */
  readonly sortField?: SchemeSortField | null | undefined;
  /** Direction to sort */
  readonly sortDirection?: SortDirection | null | undefined;
  /** Initially expanded scheme IDs */
  readonly initialExpandedIds?: readonly string[] | undefined;
}

export interface UseConsolidatedHoldingsResult {
  /** All consolidated schemes prior to filtering */
  readonly allSchemes: readonly ConsolidatedSchemeGroup[];
  /** Consolidated schemes filtered by scope, search query, and asset type */
  readonly filteredSchemes: readonly ConsolidatedSchemeGroup[];
  /** Filtered schemes sorted by specified field and direction */
  readonly sortedSchemes: readonly ConsolidatedSchemeGroup[];
  /** Set of expanded scheme IDs */
  readonly expandedSchemeIds: ReadonlySet<string>;
  /** Check if a scheme is currently expanded */
  readonly isExpanded: (schemeId: string) => boolean;
  /** Toggle expansion state of a scheme */
  readonly toggleExpanded: (schemeId: string) => void;
  /** Expand all schemes */
  readonly expandAll: () => void;
  /** Collapse all schemes */
  readonly collapseAll: () => void;
}

/**
 * Filters folios by active portfolio scope.
 */
function filterFoliosByScope(
  folios: readonly FolioInput[],
  scope?: PortfolioScope
): FolioInput[] {
  if (!scope || scope.type === 'consolidated') {
    return [...folios];
  }

  // Filter to matching profile/PAN
  return folios.filter((folio) => {
    if (!scope.pan || !folio.pan) {
      return false;
    }
    return folio.pan.toUpperCase() === scope.pan.toUpperCase();
  });
}

/**
 * Tests if a scheme matches the search query.
 */
function matchesSearch(group: ConsolidatedSchemeGroup, query: string): boolean {
  const q = query.toLowerCase();
  if (group.schemeName.toLowerCase().includes(q)) return true;
  if (group.isin && group.isin.toLowerCase().includes(q)) return true;
  if (group.amfiCode && group.amfiCode.toLowerCase().includes(q)) return true;
  return group.folios.some(
    (f) =>
      (f.folioNumber && f.folioNumber.toLowerCase().includes(q)) ||
      (f.number && f.number.toLowerCase().includes(q)) ||
      (f.pan && f.pan.toLowerCase().includes(q))
  );
}

/**
 * Tests if a scheme matches the asset type filter.
 */
function matchesAssetType(group: ConsolidatedSchemeGroup, typeFilter: string): boolean {
  const normalizedFilter = typeFilter.toUpperCase().trim();
  if (!normalizedFilter || normalizedFilter === 'ALL') return true;
  return group.type.toUpperCase() === normalizedFilter;
}

/**
 * Hook to manage consolidated holdings calculation, filtering, sorting, and row expansion.
 *
 * @param options - Configuration options.
 * @returns Filtered, sorted schemes and expansion controls.
 */
export function useConsolidatedHoldings(
  options: UseConsolidatedHoldingsOptions = {}
): UseConsolidatedHoldingsResult {
  const {
    folios,
    scope,
    searchQuery = '',
    assetTypeFilter,
    performanceMode = 'XIRR',
    sortField = null,
    sortDirection = null,
    initialExpandedIds = [],
  } = options;

  const [expandedIds, setExpandedIds] = useState<Set<string>>(
    () => new Set(initialExpandedIds)
  );

  // 1. Filter raw folios by scope first
  const scopedFolios = useMemo(() => {
    if (!folios || folios.length === 0) return [];
    return filterFoliosByScope(folios, scope);
  }, [folios, scope]);

  // 2. Consolidate into scheme groups
  const allSchemes = useMemo(() => {
    return consolidateFoliosIntoSchemes(scopedFolios);
  }, [scopedFolios]);

  // 3. Filter schemes by search query and asset type
  const filteredSchemes = useMemo(() => {
    let result = allSchemes;
    const trimmedQuery = searchQuery.trim();

    if (trimmedQuery.length > 0) {
      result = result.filter((group) => matchesSearch(group, trimmedQuery));
    }

    if (assetTypeFilter && assetTypeFilter !== 'ALL') {
      result = result.filter((group) => matchesAssetType(group, assetTypeFilter));
    }

    return result;
  }, [allSchemes, searchQuery, assetTypeFilter]);

  // 4. Sort filtered schemes
  const sortedSchemes = useMemo(() => {
    return sortSchemeGroups(filteredSchemes, sortField, sortDirection, performanceMode);
  }, [filteredSchemes, sortField, sortDirection, performanceMode]);

  // Expansion controls
  const toggleExpanded = useCallback((schemeId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(schemeId)) {
        next.delete(schemeId);
      } else {
        next.add(schemeId);
      }
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    setExpandedIds(new Set(allSchemes.map((s) => s.id)));
  }, [allSchemes]);

  const collapseAll = useCallback(() => {
    setExpandedIds(new Set());
  }, []);

  const isExpanded = useCallback(
    (schemeId: string) => expandedIds.has(schemeId),
    [expandedIds]
  );

  return {
    allSchemes,
    filteredSchemes,
    sortedSchemes,
    expandedSchemeIds: expandedIds,
    isExpanded,
    toggleExpanded,
    expandAll,
    collapseAll,
  };
}
