import React, { useState, useEffect } from 'react';
import api, { API_ENDPOINTS } from '../../api';
import { X, AlertCircle } from 'lucide-react';
import type { SimulationSellResponse, FolioView } from '../../types/generated';
import { SimulationForm } from './SimulationForm';
import { SimulationResultView } from './SimulationResultView';
import { hasOpeningBalanceHistory } from './simulation-utils';

interface SimulationModalProps {
  folio: FolioView;
  onClose: () => void;
  initialUnits?: number | undefined;
  taxSlab: number;
}

const getPrice = (folio: FolioView): number => {
  if (folio.metrics?.currentPrice && folio.metrics.currentPrice > 0) {
    return folio.metrics.currentPrice;
  }
  if (folio.transactions && folio.transactions.length > 0) {
    const sorted = [...folio.transactions].sort((a, b) => {
      const timeA = Date.parse(a.date) || 0;
      const timeB = Date.parse(b.date) || 0;
      return timeB - timeA;
    });
    return sorted[0]?.nav || 0;
  }
  return 0;
};

const formatCurrency = (val: number): string => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(val);
};

export const SimulationModal: React.FC<SimulationModalProps> = ({
  folio,
  onClose,
  initialUnits,
  taxSlab,
}) => {
  const [amount, setAmount] = useState('');
  const [result, setResult] = useState<SimulationSellResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const currentPrice = getPrice(folio);
  const parsedAmount = parseFloat(amount.replace(/,/g, ''));
  const unitsToSell = currentPrice > 0 && !isNaN(parsedAmount) ? parsedAmount / currentPrice : 0;

  const handleSimulate = React.useCallback(
    async (overrideUnits?: number): Promise<void> => {
      const units = overrideUnits !== undefined ? overrideUnits : unitsToSell;

      if (isNaN(units) || units <= 0) {
        setError('Please enter a valid positive amount.');
        return;
      }

      try {
        setLoading(true);
        setError('');
        const res = await api.post<SimulationSellResponse>(`${API_ENDPOINTS.TAX}/simulate-sell`, {
          folioId: folio.id,
          units: units,
          taxSlab: taxSlab,
          currentPrice: currentPrice > 0 ? currentPrice : undefined,
        });
        setResult(res.data);
      } catch (err: unknown) {
        console.error('Simulation API Error:', err);
        let errorMessage = 'Simulation failed';
        if (err && typeof err === 'object') {
          const anyErr = err as { response?: { data?: { error?: string } }; message?: string };
          errorMessage = anyErr.response?.data?.error || anyErr.message || errorMessage;
        }
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    },
    [unitsToSell, folio.id, taxSlab, currentPrice]
  );

  useEffect(() => {
    if (initialUnits && currentPrice > 0) {
      setAmount((initialUnits * currentPrice).toFixed(2));
      handleSimulate(initialUnits);
    }
  }, [initialUnits, currentPrice, handleSimulate]);

  const hasIncompleteHistory = hasOpeningBalanceHistory(folio);

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: '600px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem' }}>Withdrawal Simulation</h2>
            <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              {folio.asset?.name || folio.name || 'Asset'}
            </div>
          </div>
          <button onClick={onClose} className="theme-toggle" style={{ border: 'none' }}>
            <X size={24} />
          </button>
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

        {hasIncompleteHistory && (
          <div className="card" style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)', border: '1px solid var(--warning-color)', marginBottom: '1rem', color: 'var(--warning-color)' }}>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <AlertCircle size={20} />
              <div>
                <strong>Incomplete History:</strong> The tax and load estimates rely on synthetic anchors and might not be strictly accurate for compliance.
              </div>
            </div>
          </div>
        )}

        {!result ? (
          <SimulationForm
            amount={amount}
            onAmountChange={setAmount}
            onSimulate={() => handleSimulate()}
            loading={loading}
            unitsToSell={unitsToSell}
            currentPrice={currentPrice}
            error={error}
            formatCurrency={formatCurrency}
          />
        ) : (
          <SimulationResultView
            result={result}
            onReset={() => setResult(null)}
            formatCurrency={formatCurrency}
          />
        )}
      </div>
    </div>
  );
};
