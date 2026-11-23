import React from 'react';
import { ChevronDown, ChevronRight, Trash2 } from 'lucide-react';
import type { EnrichedFolioView } from '../../types/portfolio';
import { formatPercent } from './PerformanceCells';

interface ClosedFoliosSectionProps {
  closedFolios: EnrichedFolioView[];
  showClosedFolios: boolean;
  onToggleShowClosedFolios: () => void;
  onSelectFolioForTransactions: (folio: EnrichedFolioView) => void;
  onDeleteFolio: (folio: EnrichedFolioView) => Promise<void>;
}

/**
 * Collapsible section displaying fully redeemed / closed folios with historical returns.
 */
export const ClosedFoliosSection: React.FC<ClosedFoliosSectionProps> = ({
  closedFolios,
  showClosedFolios,
  onToggleShowClosedFolios,
  onSelectFolioForTransactions,
  onDeleteFolio,
}) => {
  return (
    <div style={{ marginTop: '1.5rem', padding: '1rem', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
      <div
        onClick={onToggleShowClosedFolios}
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {showClosedFolios ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>
            Closed / Fully Redeemed Positions ({closedFolios.length})
          </span>
        </div>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
          {showClosedFolios ? 'Hide' : 'Show'}
        </span>
      </div>

      {showClosedFolios && (
        <div style={{ marginTop: '1rem', overflowX: 'auto' }}>
          <table className="data-table" style={{ opacity: 0.85 }}>
            <thead>
              <tr>
                <th>Scheme Name</th>
                <th>Folio</th>
                <th>Status</th>
                <th>Type</th>
                <th>Historical XIRR / Return</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {closedFolios.map((cf) => (
                <tr
                  key={cf.id}
                  onClick={() => onSelectFolioForTransactions(cf)}
                  style={{ cursor: 'pointer' }}
                >
                  <td>{cf.asset?.name || 'Unknown'}</td>
                  <td>{cf.number || 'N/A'}</td>
                  <td>
                    <span className="badge badge-slab" style={{ backgroundColor: 'rgba(100, 116, 139, 0.2)', color: 'var(--text-secondary)' }}>
                      Fully Redeemed
                    </span>
                  </td>
                  <td><span className="badge badge-slab">{cf.asset?.type}</span></td>
                  <td>{formatPercent(cf.metrics?.xirr || cf.metrics?.absoluteReturn || 0)}</td>
                  <td>
                    <button
                      className="theme-toggle"
                      title="Delete Folio"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteFolio(cf);
                      }}
                      style={{ color: 'var(--danger-color)', padding: '2px 6px' }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
