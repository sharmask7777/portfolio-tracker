import React from 'react';
import { Calculator, X } from 'lucide-react';
import type { EnrichedFolioView } from '../../types/portfolio';
import { isValidNumber } from './PerformanceCells';

interface FolioRowActionButtonsProps {
  folio: EnrichedFolioView;
  onSimulateSell: (f: EnrichedFolioView) => void;
  onDeleteManualAsset: (id: string) => Promise<void>;
}

export function formatCurrency(val: unknown): string {
  if (!isValidNumber(val)) return 'N/A';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(val);
}

/**
 * Action buttons (sell simulation calculator and manual asset deletion) for a folio row.
 */
export const FolioRowActionButtons: React.FC<FolioRowActionButtonsProps> = ({
  folio,
  onSimulateSell,
  onDeleteManualAsset,
}) => {
  const isManual = Boolean(folio.number && folio.number.startsWith('MANUAL_'));

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this asset?')) {
      await onDeleteManualAsset(folio.id);
    }
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
      <button
        className="theme-toggle"
        title="Simulate Sell Tax"
        onClick={(e) => {
          e.stopPropagation();
          onSimulateSell(folio);
        }}
      >
        <Calculator size={16} />
      </button>
      {isManual && (
        <button
          className="theme-toggle"
          title="Delete Asset"
          onClick={handleDelete}
          style={{ marginLeft: '0.25rem', color: 'var(--danger-color)' }}
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
};
