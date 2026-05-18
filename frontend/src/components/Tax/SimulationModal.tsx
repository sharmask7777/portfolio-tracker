import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { X, AlertCircle, Info, TrendingDown, DollarSign } from 'lucide-react';
import { API_ENDPOINTS } from '../../config';
import { useSettings } from '../../contexts/SettingsContext';

interface SimulationModalProps {
  folio: any;
  onClose: () => void;
  initialUnits?: number;
}

export const SimulationModal: React.FC<SimulationModalProps> = ({ folio, onClose, initialUnits }) => {
  const { taxSlab } = useSettings();
  const [amount, setAmount] = useState('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const getPrice = () => {
    if (folio.metrics?.currentPrice > 0) return folio.metrics.currentPrice;
    if (folio.transactions && folio.transactions.length > 0) {
      const sorted = [...folio.transactions].sort((a, b) => 
        new Date(b.date).getTime() - new Date(a.date).getTime()
      );
      return sorted[0].nav || 0;
    }
    return 0;
  };

  const currentPrice = getPrice();
  const parsedAmount = parseFloat(amount.replace(/,/g, ''));
  const unitsToSell = (currentPrice > 0 && !isNaN(parsedAmount)) ? (parsedAmount / currentPrice) : 0;

  const handleSimulate = async (overrideUnits?: number) => {
    const units = overrideUnits !== undefined ? overrideUnits : unitsToSell;
    
    if (isNaN(units) || units <= 0) {
      setError('Please enter a valid positive amount.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const res = await axios.post(`${API_ENDPOINTS.TAX}/simulate-sell`, {
        folioId: folio.id,
        units: units,
        taxSlab: taxSlab,
      });
      setResult(res.data);
    } catch (err: any) {
      console.error('Simulation API Error:', err);
      const backendError = err.response?.data?.error;
      const axiosError = err.message;
      setError(backendError || axiosError || 'Simulation failed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialUnits && currentPrice > 0) {
      setAmount((initialUnits * currentPrice).toFixed(2));
      handleSimulate(initialUnits);
    }
  }, [initialUnits, currentPrice]);

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
          <div>
            <h2 style={{ fontSize: '1.25rem' }}>Withdrawal Simulation</h2>
            <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{folio.asset.name}</div>
          </div>
          <button onClick={onClose} className="theme-toggle" style={{ border: 'none' }}><X size={24} /></button>
        </div>

        {currentPrice === 0 && (
          <div className="card" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--danger-color)', marginBottom: '1rem', color: 'var(--danger-color)' }}>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <AlertCircle size={20} />
              <div>
                <strong>Missing NAV Data:</strong> Price data unavailable.
              </div>
            </div>
          </div>
        )}

        {!result ? (
          <div>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem', fontSize: '0.9375rem' }}>
              Enter the amount you plan to withdraw to estimate the tax and exit load impact.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <div style={{ flex: 1, position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', fontWeight: 600 }}>₹</span>
                  <input 
                    type="number" 
                    placeholder="e.g. 50,000" 
                    className="card" 
                    style={{ width: '100%', padding: '0.75rem 0.75rem 0.75rem 2rem', outline: 'none', fontSize: '1rem' }}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    autoFocus
                  />
                </div>
                <button 
                  className="btn btn-primary" 
                  onClick={() => handleSimulate()}
                  disabled={loading || isNaN(unitsToSell) || unitsToSell <= 0 || currentPrice === 0}
                >
                  {loading ? 'Analyzing...' : 'Analyze Impact'}
                </button>
              </div>
              {amount && !isNaN(unitsToSell) && unitsToSell > 0 && (
                <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Info size={14} /> Equivalent to <strong>{unitsToSell.toFixed(3)}</strong> units at <strong>{formatCurrency(currentPrice)}</strong>
                </div>
              )}
            </div>
            {error && (
              <div className="card" style={{ color: 'var(--danger-color)', border: '1px solid var(--danger-color)', backgroundColor: 'rgba(239, 68, 68, 0.05)', display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.875rem', padding: '1rem' }}>
                <AlertCircle size={18} /> {error}
              </div>
            )}
          </div>
        ) : (
          <div className="animate-fade">
            <div className="stats-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
              <div className="card" style={{ padding: '1.25rem' }}>
                <div className="stat-label">Market Value</div>
                <div className="stat-value" style={{ fontSize: '1.5rem' }}>{formatCurrency(result.estimatedValue)}</div>
              </div>
              <div className="card" style={{ padding: '1.25rem' }}>
                <div className="stat-label">Total Deductions</div>
                <div className="stat-value" style={{ color: 'var(--danger-color)', fontSize: '1.5rem' }}>
                  {formatCurrency(result.taxBreakdown.totalTax + result.exitLoad)}
                </div>
              </div>
            </div>

            <div className="card" style={{ background: 'var(--bg-secondary)', border: 'none', marginBottom: '1rem' }}>
              <h4 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <TrendingDown size={18} /> Impact Breakdown
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>LTCG Tax Estimate:</span>
                  <strong className={result.taxBreakdown.ltcg.tax > 0 ? 'negative' : ''}>{formatCurrency(result.taxBreakdown.ltcg.tax)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>STCG Tax Estimate:</span>
                  <strong className={result.taxBreakdown.stcg.tax > 0 ? 'negative' : ''}>{formatCurrency(result.taxBreakdown.stcg.tax)}</strong>
                </div>
                {result.taxBreakdown.slab.amount !== 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Slab Rate Gains:</span>
                    <strong>{formatCurrency(result.taxBreakdown.slab.amount)}</strong>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Exit Load (1% estimate):</span>
                  <strong className={result.exitLoad > 0 ? 'negative' : ''}>{formatCurrency(result.exitLoad)}</strong>
                </div>
                <div style={{ borderTop: '1px solid var(--border-color)', marginTop: '0.5rem', paddingTop: '0.5rem', display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 600 }}>Net Withdrawal:</span>
                  <span className="positive" style={{ fontWeight: 700, fontSize: '1.125rem' }}>
                    {formatCurrency(result.estimatedValue - result.taxBreakdown.totalTax - result.exitLoad)}
                  </span>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
              <Info size={14} style={{ flexShrink: 0 }} />
              <p>Exit loads are estimated based on holding period (1% for &lt;1yr). Actual loads may vary by fund policy. Tax estimates do not include cess.</p>
            </div>

            <button 
              className="btn btn-primary" 
              style={{ width: '100%', justifyContent: 'center' }}
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
