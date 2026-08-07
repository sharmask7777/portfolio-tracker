import { X } from 'lucide-react';

export function TransactionSidePanel({ folio, onClose }: { folio: any, onClose: () => void }) {
  if (!folio) return null;

  const sortedTransactions = folio.transactions
    ? [...folio.transactions].sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
    : [];

  return (
    <>
      <div className="side-panel-overlay" onClick={onClose}></div>
      <div className="side-panel" onClick={(e) => e.stopPropagation()}>
        <div className="side-panel-header">
          <h2 style={{ margin: 0, fontSize: '1.25rem' }}>{folio.asset.name}</h2>
          <button aria-label="Close panel" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
            <X />
          </button>
        </div>
        <div className="side-panel-content">
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
