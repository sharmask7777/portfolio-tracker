import React, { useState } from 'react';
import axios from 'axios';
import { X, AlertCircle } from 'lucide-react';

interface SimulationModalProps {
  folio: any;
  onClose: () => void;
}

export const SimulationModal: React.FC<SimulationModalProps> = ({ folio, onClose }) => {
  const [amount, setAmount] = useState('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const currentPrice = folio.metrics.currentPrice || 0;
  const unitsToSell = currentPrice > 0 ? (parseFloat(amount) / currentPrice) : 0;

  const handleSimulate = async () => {
    if (!amount || parseFloat(amount) <= 0) return;

    try {
      setLoading(true);
      setError('');
      const res = await axios.post('http://localhost:3001/api/tax/simulate-sell', {
        folioId: folio.id,
        units: unitsToSell,
      });
      setResult(res.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Simulation failed');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(val);
  };

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: '600px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2>Tax Simulation: {folio.asset.name}</h2>
          <button onClick={onClose}><X size={24} /></button>
        </div>

        {!result ? (
          <div>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
              Enter the amount you plan to withdraw to estimate the tax liability.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <div style={{ flex: 1, position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }}>₹</span>
                  <input 
                    type="number" 
                    placeholder="Amount to sell" 
                    className="card" 
                    style={{ width: '100%', padding: '0.75rem 0.75rem 0.75rem 2rem', outline: 'none' }}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </div>
                <button 
                  className="btn btn-primary" 
                  onClick={handleSimulate}
                  disabled={loading || !amount}
                >
                  {loading ? 'Analyzing...' : 'Analyze Tax'}
                </button>
              </div>
              {amount && (
                <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                  Equivalent to <strong>{unitsToSell.toFixed(3)}</strong> units at current NAV ({formatCurrency(currentPrice)})
                </div>
              )}
            </div>
            {error && (
              <div style={{ color: 'var(--danger-color)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
                <AlertCircle size={16} /> {error}
              </div>
            )}
          </div>
        ) : (
          <div>
            <div className="stats-grid" style={{ gridTemplateColumns: '1fr 1fr', marginBottom: '1.5rem' }}>
              <div className="card">
                <div className="stat-label">Estimated Value</div>
                <div className="stat-value">{formatCurrency(result.estimatedValue)}</div>
              </div>
              <div className="card">
                <div className="stat-label">Estimated Total Tax</div>
                <div className="stat-value" style={{ color: 'var(--danger-color)' }}>
                  {formatCurrency(result.taxBreakdown.totalTax)}
                </div>
              </div>
            </div>

            <div className="card" style={{ background: 'var(--bg-secondary)', border: 'none' }}>
              <h4 style={{ marginBottom: '1rem' }}>Tax Breakdown</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>LTCG Tax (12.5%):</span>
                  <strong>{formatCurrency(result.taxBreakdown.ltcg.tax)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>STCG Tax (20%):</span>
                  <strong>{formatCurrency(result.taxBreakdown.stcg.tax)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                  <span>Total Realized Gain:</span>
                  <span>{formatCurrency(result.totalGain)}</span>
                </div>
              </div>
            </div>

            <button 
              className="btn btn-primary" 
              style={{ width: '100%', marginTop: '1.5rem' }}
              onClick={() => setResult(null)}
            >
              Adjust Amount
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
