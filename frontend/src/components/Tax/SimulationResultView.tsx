import React from 'react';
import { Info, TrendingDown } from 'lucide-react';
import type { SimulationSellResponse, RealizedGain } from '../../types/generated';

interface SimulationResultViewProps {
  result: SimulationSellResponse;
  onReset: () => void;
  formatCurrency: (val: number) => string;
}

const isLtcg = (l: RealizedGain): boolean => {
  return (l.taxType || '').toUpperCase() === 'LTCG';
};

const isStcg = (l: RealizedGain): boolean => {
  return (l.taxType || '').toUpperCase() === 'STCG';
};

const getLotRate = (l?: RealizedGain): number | undefined => {
  if (!l) return undefined;
  const rate = l.taxRate;
  if (typeof rate === 'number') return rate;
  if (typeof rate === 'string') return parseFloat(rate);
  return undefined;
};

const TaxRow: React.FC<{
  label: string;
  amount: number;
  formatCurrency: (val: number) => string;
}> = ({ label, amount, formatCurrency }) => {
  if (amount === 0) return null;
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
      <span style={{ color: 'var(--text-secondary)' }}>{label}:</span>
      <strong className="negative">{formatCurrency(amount)}</strong>
    </div>
  );
};

const ImpactBreakdown: React.FC<{
  tb: NonNullable<SimulationSellResponse['taxBreakdown']>;
  exitLoad: number;
  estValue: number;
  totalTax: number;
  ltcgRateLabel: string;
  stcgRateLabel: string;
  totalCess: number;
  formatCurrency: (val: number) => string;
}> = ({
  tb,
  exitLoad,
  estValue,
  totalTax,
  ltcgRateLabel,
  stcgRateLabel,
  totalCess,
  formatCurrency,
}) => (
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
      <TaxRow label="Slab Tax Estimate" amount={tb.slab?.tax ?? 0} formatCurrency={formatCurrency} />
      <TaxRow label="Health & Education Cess (4%)" amount={totalCess} formatCurrency={formatCurrency} />
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
);

function getRateLabels(matchedLots?: RealizedGain[]) {
  const ltcgLot = matchedLots?.find(isLtcg);
  const ltcgRate = getLotRate(ltcgLot);
  const ltcgRateLabel = ltcgRate === 0.1 ? '10%' : '12.5%';

  const stcgLot = matchedLots?.find(isStcg);
  const stcgRate = getLotRate(stcgLot);
  const stcgRateLabel = stcgRate === 0.15 ? '15%' : '20%';

  return { ltcgRateLabel, stcgRateLabel };
}

export const SimulationResultView: React.FC<SimulationResultViewProps> = ({
  result,
  onReset,
  formatCurrency,
}) => {
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
  const { ltcgRateLabel, stcgRateLabel } = getRateLabels(result.matchedLots);

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

      <ImpactBreakdown
        tb={tb}
        exitLoad={exitLoad}
        estValue={estValue}
        totalTax={totalTax}
        ltcgRateLabel={ltcgRateLabel}
        stcgRateLabel={stcgRateLabel}
        totalCess={totalCess}
        formatCurrency={formatCurrency}
      />

      <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
        <Info size={14} style={{ flexShrink: 0 }} />
        <p>Exit loads are estimated based on holding period and fund scheme rules. Tax estimates reflect Budget 2024 statutory rates (12.5% LTCG, 20% STCG) and 4% health &amp; education cess.</p>
      </div>

      <button 
        className="btn btn-primary" 
        style={{ width: '100%', justifyContent: 'center' }}
        onClick={onReset}
      >
        Adjust Amount
      </button>
    </div>
  );
};
