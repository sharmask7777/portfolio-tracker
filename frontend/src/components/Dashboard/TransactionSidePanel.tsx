import { X, Trash2 } from 'lucide-react';

interface TransactionSidePanelProps {
  folio: any;
  onClose: () => void;
  onDeleteFolio?: (folio: any) => Promise<void>;
}

export function TransactionSidePanel({ folio, onClose, onDeleteFolio }: TransactionSidePanelProps) {
  if (!folio) return null;

  const sortedTransactions = folio.transactions
    ? [...folio.transactions].sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
    : [];

  return (
    <>
      <div className="side-panel-overlay" onClick={onClose}></div>
      <div className="side-panel" onClick={(e) => e.stopPropagation()}>
        <div className="side-panel-header">
          <div>
            <h2 style={{ margin: 0, fontSize: '1.25rem' }}>{folio.asset?.name || 'Asset Transactions'}</h2>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
              Folio: {folio.number || 'N/A'} {folio.pan ? `• PAN: ${folio.pan}` : ''}
            </div>
          </div>
          <button aria-label="Close panel" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-primary)' }}>
            <X />
          </button>
        </div>
        <div className="side-panel-content">
          {onDeleteFolio && (
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border-color)' }}>
              <button
                className="btn btn-secondary"
                style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8125rem', padding: '0.4rem 0.75rem', color: 'var(--danger-color, #ef4444)' }}
                onClick={() => onDeleteFolio(folio)}
                title="Delete this folio and all its transactions"
              >
                <Trash2 size={14} />
                Delete Folio
              </button>
            </div>
          )}

          <h3>Transactions</h3>
          <div className="transaction-list">
            {sortedTransactions.map((tx: any, idx: number) => (
              <div key={tx.id || idx} className="transaction-item">
                <div>
                  <strong>{tx.type}</strong>
                  <div style={{ fontSize: '0.85rem', color: 'gray' }}>
                    {new Date(tx.date).toLocaleDateString()}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div>₹{Math.abs(tx.amount).toLocaleString()}</div>
                  <div style={{ fontSize: '0.85rem', color: 'gray' }}>
                    {Math.abs(tx.units)} units @ ₹{tx.nav}
                  </div>
                </div>
              </div>
            ))}
            {sortedTransactions.length === 0 && (
              <p>No transactions found.</p>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
