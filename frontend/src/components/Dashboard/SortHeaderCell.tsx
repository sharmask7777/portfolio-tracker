import React from 'react';
import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import type { SchemeSortField, SortDirection } from '@portfolio/core-view';

interface SortHeaderCellProps {
  label: string;
  field: SchemeSortField;
  sortField: SchemeSortField | null;
  sortDirection: SortDirection | null;
  onSort: (f: SchemeSortField) => void;
}

/**
 * Clickable table header cell that triggers sorting by scheme attribute.
 */
export const SortHeaderCell: React.FC<SortHeaderCellProps> = ({
  label,
  field,
  sortField,
  sortDirection,
  onSort,
}) => {
  const isSorted = sortField === field;
  return (
    <th onClick={() => onSort(field)} style={{ cursor: 'pointer', userSelect: 'none' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
        <span>{label}</span>
        {isSorted ? (
          sortDirection === 'asc' ? (
            <ArrowUp size={14} style={{ color: 'var(--accent-color)' }} />
          ) : (
            <ArrowDown size={14} style={{ color: 'var(--accent-color)' }} />
          )
        ) : (
          <ArrowUpDown size={14} style={{ opacity: 0.3 }} />
        )}
      </div>
    </th>
  );
};
