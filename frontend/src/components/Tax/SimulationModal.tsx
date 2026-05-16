import React, { useState } from 'react';
import axios from 'axios';
import { X, AlertCircle } from 'lucide-react';

interface SimulationModalProps {
  folio: any;
  onClose: () => void;
}

export const SimulationModal: React.FC<SimulationModalProps> = ({ folio, onClose }) => {
  const [units, setUnits] = useState('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSimulate = async () => {
    if (!units || parseFloat(units) <= 0) return;

    try {
      setLoading(true);
      setError('');
      const res = await axios.post('http://localhost:3001/api/tax/simulate-sell', {
        folioId: folio.id,
        units: parseFloat(units),
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
              Enter the number of units you plan to sell to estimate the tax liability.
            </p>
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
              <input 
                type="number" 
                placeholder="Units to sell" 
                className="card" 
                style={{ flex: 1, padding: '0.75rem', outline: 'none' }}
                value={units}
                onChange={(e) => setUnits(e.target.value)}
              />
              <button 
                className="btn btn-primary" 
                onClick={handleSimulate}
                disabled={loading}
              >
                {loading ? 'Analyzing...' : 'Analyze Tax'}
              </button>
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
              Adjust Units
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
