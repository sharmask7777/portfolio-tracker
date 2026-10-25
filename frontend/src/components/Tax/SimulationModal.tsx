import React, { useState, useEffect } from 'react';
import api, { API_ENDPOINTS } from '../../api';
import { X, AlertCircle, Info, TrendingDown } from 'lucide-react';
import type { SimulationSellResponse, FolioView, RealizedGain } from '../../types/generated';

interface SimulationModalProps {
  folio: FolioView;
  onClose: () => void;
  initialUnits?: number;
  taxSlab: number;
}

export const SimulationModal: React.FC<SimulationModalProps> = ({ folio, onClose, initialUnits, taxSlab }) => {
  const [amount, setAmount] = useState('');
  const [result, setResult] = useState<SimulationSellResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const getPrice = (): number => {
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

  const currentPrice = getPrice();
  const parsedAmount = parseFloat(amount.replace(/,/g, ''));
  const unitsToSell = (currentPrice > 0 && !isNaN(parsedAmount)) ? (parsedAmount / currentPrice) : 0;

  const handleSimulate = async (overrideUnits?: number): Promise<void> => {
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
  };

  useEffect(() => {
    if (initialUnits && currentPrice > 0) {
      setAmount((initialUnits * currentPrice).toFixed(2));
      handleSimulate(initialUnits);
    }
  }, [initialUnits, currentPrice]);

  const formatCurrency = (val: number): string => {
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
            <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{folio.asset?.name || folio.name || 'Asset'}</div>
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
        {(() => {
          const sorted = [...(folio.transactions || [])].sort((a, b) => (Date.parse(a.date) || 0) - (Date.parse(b.date) || 0));
          const lots: { type: string; units: number }[] = [];
          for (const tx of sorted) {
            const rawUnits = tx.units;
            if (rawUnits === undefined || rawUnits === null || isNaN(rawUnits)) continue;
            const units = Math.abs(rawUnits);
            if (units <= 0.000001) continue;
            const type = (tx.type || '').toLowerCase();
            if (!type) continue; // skip transactions with missing type
            if (type.includes('buy') || type.includes('purchase') || type.includes('sip') || type.includes('switch_in') || type.includes('reinvestment') || type.includes('opening_balance') || type.includes('bonus')) {
              lots.push({ type: tx.type || '', units });
            } else if (type.includes('sell') || type.includes('redemption') || type.includes('switch_out') || type.includes('transfer_out') || type.includes('off_market')) {
              let remainingUnitsToSell = units;
              while (remainingUnitsToSell > 0.000001 && lots.length > 0) {
                const head = lots[0];
                if (!head) break;
                const sold = Math.min(remainingUnitsToSell, head.units);
                head.units -= sold;
                remainingUnitsToSell -= sold;
                if (head.units <= 0.000001) lots.shift();
              }
            }
          }
          return lots.some(lot => ((lot.type || '').toLowerCase().includes('opening_balance') || lot.type === 'OPENING_BALANCE') && lot.units > 0.000001);
        })() && (
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
          (() => {
            const tb = result.taxBreakdown || {
              stcg: { amount: 0, tax: 0, cess: 0 },
              ltcg: { amount: 0, tax: 0, cess: 0 },
              slab: { amount: 0, tax: 0, cess: 0 },
              totalTax: result.estimatedTax ?? 0,
            };
            const totalTax = tb.totalTax ?? result.estimatedTax ?? 0;
            const exitLoad = result.exitLoad ?? 0;
            const estValue = result.estimatedValue ?? 0;
            const totalCess = (tb.ltcg?.cess ?? 0) + (tb.stcg?.cess ?? 0) + (tb.slab?.cess ?? 0);

            // Determine effective rates from matched lots, defaulting to Budget 2024 statutory rates
            const isLtcg = (l: RealizedGain): boolean => {
              const t = (l.taxType || (l as unknown as { tax_type?: string }).tax_type || '').toUpperCase();
              return t === 'LTCG';
            };
            const isStcg = (l: RealizedGain): boolean => {
              const t = (l.taxType || (l as unknown as { tax_type?: string }).tax_type || '').toUpperCase();
              return t === 'STCG';
            };
            const getLotRate = (l?: RealizedGain): number | undefined => {
              if (!l) return undefined;
              const rate = l.taxRate ?? (l as unknown as { tax_rate?: number | string }).tax_rate;
              if (typeof rate === 'number') return rate;
              if (typeof rate === 'string') return parseFloat(rate);
              return undefined;
            };

            const ltcgLot = result.matchedLots?.find(isLtcg);
            const ltcgRate = getLotRate(ltcgLot);
            const ltcgRateLabel = ltcgRate === 0.1 ? '10%' : '12.5%';

            const stcgLot = result.matchedLots?.find(isStcg);
            const stcgRate = getLotRate(stcgLot);
            const stcgRateLabel = stcgRate === 0.15 ? '15%' : '20%';

            return (
              <div className="animate-fade">
                <div className="stats-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                  <div className="card" style={{ padding: '1.25rem' }}>
                    <div className="stat-label">Market Value</div>
                    <div className="stat-value" style={{ fontSize: '1.5rem' }}>{formatCurrency(estValue)}</div>
                  </div>
                  <div className="card" style={{ padding: '1.25rem' }}>
                    <div className="stat-label">Total Deductions</div>
                    <div className="stat-value" style={{ color: 'var(--danger-color)', fontSize: '1.5rem' }}>
                      {formatCurrency(totalTax + exitLoad)}
                    </div>
                  </div>
                </div>

                <div className="card" style={{ background: 'var(--bg-secondary)', border: 'none', marginBottom: '1rem' }}>
                  <h4 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <TrendingDown size={18} /> Impact Breakdown
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>LTCG Tax Estimate ({ltcgRateLabel}):</span>
                      <strong className={(tb.ltcg?.tax ?? 0) > 0 ? 'negative' : ''}>{formatCurrency(tb.ltcg?.tax ?? 0)}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>STCG Tax Estimate ({stcgRateLabel}):</span>
                      <strong className={(tb.stcg?.tax ?? 0) > 0 ? 'negative' : ''}>{formatCurrency(tb.stcg?.tax ?? 0)}</strong>
                    </div>
                    {(tb.slab?.tax ?? 0) !== 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Slab Tax Estimate:</span>
                        <strong className="negative">{formatCurrency(tb.slab?.tax ?? 0)}</strong>
                      </div>
                    )}
                    {totalCess > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Health & Education Cess (4%):</span>
                        <strong className="negative">{formatCurrency(totalCess)}</strong>
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Exit Load:</span>
                      <strong className={exitLoad > 0 ? 'negative' : ''}>{formatCurrency(exitLoad)}</strong>
                    </div>
                    <div style={{ borderTop: '1px solid var(--border-color)', marginTop: '0.5rem', paddingTop: '0.5rem', display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontWeight: 600 }}>Net Withdrawal:</span>
                      <span className="positive" style={{ fontWeight: 700, fontSize: '1.125rem' }}>
                        {formatCurrency(estValue - totalTax - exitLoad)}
                      </span>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                  <Info size={14} style={{ flexShrink: 0 }} />
                  <p>Exit loads are estimated based on holding period and fund scheme rules. Tax estimates reflect Budget 2024 statutory rates (12.5% LTCG, 20% STCG) and 4% health &amp; education cess.</p>
                </div>

                <button 
                  className="btn btn-primary" 
                  style={{ width: '100%', justifyContent: 'center' }}
                  onClick={() => setResult(null)}
                >
                  Adjust Amount
                </button>
              </div>
            );
          })()
        )}
      </div>
    </div>
  );
};
