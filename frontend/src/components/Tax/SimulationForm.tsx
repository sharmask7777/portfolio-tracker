import React from 'react';
import { AlertCircle, Info } from 'lucide-react';

interface SimulationFormProps {
  amount: string;
  onAmountChange: (val: string) => void;
  onSimulate: () => void;
  loading: boolean;
  unitsToSell: number;
  currentPrice: number;
  error: string;
  formatCurrency: (val: number) => string;
}

export const SimulationForm: React.FC<SimulationFormProps> = ({
  amount,
  onAmountChange,
  onSimulate,
  loading,
  unitsToSell,
  currentPrice,
  error,
  formatCurrency,
}) => (
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
            onChange={(e) => onAmountChange(e.target.value)}
            autoFocus
          />
        </div>
        <button 
          className="btn btn-primary" 
          onClick={onSimulate}
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
);
